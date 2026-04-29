import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { AddTaskToggle } from "./AddTaskToggle";
import { TaskList } from "./TaskList";

export default async function TasksPage({
  searchParams,
}: {
  // v1.28.0: `?supplier=<id>` deep-links from the supplier-detail page
  // and pre-filters the tasks server-side to that supplier. We keep
  // the rest of the search/filter UI intact so the user can still
  // pivot from there.
  searchParams: Promise<{ supplier?: string }>;
}) {
  const user = await requireUser();
  if (!(await canView(user, "tasks"))) redirect("/");
  const editable = await canEdit(user, "tasks");
  const sp = await searchParams;
  const supplierFilter = typeof sp.supplier === "string" ? sp.supplier : null;

  const [tasks, users, customFieldDefs, suppliers, bookSections, navTags] = await Promise.all([
    db.task.findMany({
      where: {
        type: "TASK",
        ...(supplierFilter ? { supplierId: supplierFilter } : {}),
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      // v1.30.5: include the m2m relations for the chip-row render.
      include: {
        bookSections: { select: { id: true, title: true } },
        navTags: { select: { id: true, name: true } },
      },
    }),
    db.user.findMany({ orderBy: [{ isCouple: "desc" }, { name: "asc" }] }),
    // v1.22.0: defs scoped to task entity, passed down so TaskRow's edit
    // mode can render the custom-fields editor in the inline form.
    db.customField.findMany({ where: { entity: "task" }, orderBy: { order: "asc" } }),
    // v1.28.0: supplier picker on task forms — surface name + category.
    db.supplier.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
    }),
    // v1.30.5: book sections (page-level) for the Topics multi-select.
    db.bookSection.findMany({
      orderBy: { order: "asc" },
      select: { id: true, title: true },
    }),
    // v1.30.5: nav tags for the Topics multi-select.
    db.navTag.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, route: true },
    }),
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
  const filteredSupplier = supplierFilter
    ? suppliers.find((s) => s.id === supplierFilter)
    : null;

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
                suppliers={suppliers}
                bookSections={bookSections}
                navTags={navTags}
              />
            </>
          ) : undefined
        }
      />
      {filteredSupplier && (
        <div className="bg-moss-50 border-b border-moss-300 px-4 sm:px-6 py-2 flex items-center gap-3 text-xs">
          <span className="text-ink-secondary">
            Filtered by supplier:{" "}
            <strong className="text-ink-primary">{filteredSupplier.name}</strong>
            {filteredSupplier.category ? ` · ${filteredSupplier.category}` : ""}
          </span>
          <Link href="/tasks" className="text-info hover:underline ml-auto">
            Clear ×
          </Link>
        </div>
      )}
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
        suppliers={suppliers}
        bookSections={bookSections}
        navTags={navTags}
        currentUserId={user.id}
        canEdit={editable}
        customFieldDefs={customFieldDefsTyped}
      />
    </>
  );
}
