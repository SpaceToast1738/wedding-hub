import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddTaskToggle } from "./AddTaskToggle";
import { TaskList } from "./TaskList";

export default async function TasksPage() {
  const user = await requireUser();
  if (!(await canView(user, "tasks"))) redirect("/");
  const editable = await canEdit(user, "tasks");

  const [tasks, users] = await Promise.all([
    db.task.findMany({
      where: { type: "TASK" },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    db.user.findMany({ orderBy: [{ isCouple: "desc" }, { name: "asc" }] }),
  ]);

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
        tasks={visible}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        currentUserId={user.id}
        canEdit={editable}
      />
    </>
  );
}
