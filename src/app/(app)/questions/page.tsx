import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddTaskToggle } from "@/app/(app)/tasks/AddTaskToggle";
import { QuestionsClient } from "./QuestionsClient";

export default async function QuestionsPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "questions");

  const [questions, users] = await Promise.all([
    db.task.findMany({
      where: { type: { in: ["QUESTION", "DECISION"] } },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    }),
    db.user.findMany({ orderBy: [{ isCouple: "desc" }, { name: "asc" }] }),
  ]);

  const open = questions.filter((q) => q.status !== "DONE" && q.status !== "ARCHIVED").length;
  const answered = questions.filter((q) => q.status === "DONE").length;

  return (
    <>
      <PageHeader
        title="Questions"
        subtitle={`${open} open · ${answered} answered`}
        actions={
          editable ? (
            <AddTaskToggle
              users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
              defaultType="QUESTION"
              showType={false}
              buttonLabel="+ New question"
            />
          ) : undefined
        }
      />
      <QuestionsClient
        questions={questions.map((q) => ({
          id: q.id,
          title: q.title,
          type: q.type,
          status: q.status,
          priority: q.priority,
          assigneeId: q.assigneeId,
          dueDate: q.dueDate,
          questionAnswer: q.questionAnswer,
        }))}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        editable={editable}
      />
    </>
  );
}
