import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddTaskToggle } from "./AddTaskToggle";
import { TaskList } from "./TaskList";

export default async function TasksPage() {
  const user = await requireUser();
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
            <AddTaskToggle
              users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
            />
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
