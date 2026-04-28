import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { AddTaskToggle } from "./AddTaskToggle";
import { TaskList } from "./TaskList";

export default async function TasksPage() {
  const user = await requireUser();
  if (!(await canView(user, "tasks"))) redirect("/");
  const editable = await canEdit(user, "tasks");

  const [tasks, users, customFieldDefs] = await Promise.all([
    db.task.findMany({
      where: { type: "TASK" },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    db.user.findMany({ orderBy: [{ isCouple: "desc" }, { name: "asc" }] }),
    // v1.22.0: defs scoped to task entity, passed down so TaskRow's edit
    // mode can render the custom-fields editor in the inline form.
    db.customField.findMany({ where: { entity: "task" }, orderBy: { order: "asc" } }),
  ]);
  const customFieldDefsTyped: CustomFieldDef[] = customFieldDefs.map((f) => ({
    id: f.id,
    entity: f.entity,
    name: f.name,
    type: f.type as "text" | "number" | "date" | "select",
    options: f.options,
    order: f.order,
  }));

  // Hide budget-tagged tasks from non-couple users
  const visible = user.isCouple ? tasks : tasks.filter((t) => !t.tags.includes("Budget"));
  const open = visible.filter((t) => t.status !== "DONE" && t.status !== "ARCHIVED").length;
  const done = visible.filter((t) => t.status === "DONE").length;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${open} open · ${done} done`}
        actions={
          editable ? (
            <>
              <Link
                href="/tasks/import"
                className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
              >
                Import CSV
              </Link>
              <AddTaskToggle
                users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
              />
            </>
          ) : undefined
        }
      />
      <TaskList
        tasks={visible.map((t) => ({
          ...t,
          // Prisma's JsonValue type is wider than the strict
          // Record<…> the client expects; cast through unknown so the
          // client's runtime shape matches what the action wrote.
          customFieldValues:
            (t.customFieldValues as unknown as Record<string, string | number | null> | null) ?? null,
        }))}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        currentUserId={user.id}
        canEdit={editable}
        customFieldDefs={customFieldDefsTyped}
      />
    </>
  );
}
