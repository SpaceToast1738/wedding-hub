import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { formatRelativeDue } from "@/lib/format";
import { AddTaskToggle } from "@/app/(app)/tasks/AddTaskToggle";
import { AnswerForm } from "./AnswerForm";

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
  const usersById = new Map(users.map((u) => [u.id, u]));

  const open = questions.filter((q) => q.status !== "DONE" && q.status !== "ARCHIVED");
  const answered = questions.filter((q) => q.status === "DONE");

  return (
    <>
      <PageHeader
        title="Questions"
        subtitle={`${open.length} open · ${answered.length} answered`}
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
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <Section title="Open" items={open} usersById={usersById} editable={editable} showAnswer />
          <Section title="Answered" items={answered} usersById={usersById} editable={editable} showAnswer />
          {questions.length === 0 && (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No questions yet. {editable && "Add the first one above."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

type Q = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: Date | null;
  questionAnswer: string | null;
};

function Section({
  title,
  items,
  usersById,
  editable,
}: {
  title: string;
  items: Q[];
  usersById: Map<string, { name: string | null; email: string }>;
  editable: boolean;
  showAnswer: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider mb-2">{title}</h2>
      <ol className="bg-surface border border-border-soft rounded-md shadow-sm divide-y divide-border-soft">
        {items.map((q) => {
          const a = q.assigneeId ? usersById.get(q.assigneeId) : null;
          return (
            <li key={q.id} className="px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className={`text-[10px] font-bold flex-shrink-0 px-1 rounded ${q.type === "DECISION" ? "text-marigold-700 bg-marigold-100" : "text-info bg-[color:#eef4f5] dark:bg-muted"}`}>
                  {q.type === "DECISION" ? "△" : "?"}
                </span>
                <span className={`text-sm flex-1 ${q.status === "DONE" ? "text-ink-tertiary" : "text-ink-primary font-medium"}`}>
                  {q.title}
                </span>
                {a && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <Avatar name={a.name ?? a.email} size={18} />
                    <span className="text-xs text-ink-tertiary">{(a.name ?? a.email).split(" ")[0]}</span>
                  </span>
                )}
                <StatusPill
                  status={q.status === "DONE" ? "DONE" : q.priority === "HIGH" || q.priority === "URGENT" ? "HIGH" : q.priority === "LOW" ? "LOW" : "MED"}
                  label={q.status === "DONE" ? "Answered" : q.priority === "MEDIUM" ? "MED" : q.priority}
                />
                <span className="text-xs text-ink-tertiary w-20 text-right">{formatRelativeDue(q.dueDate)}</span>
              </div>
              {q.questionAnswer && q.status === "DONE" && (
                <p className="text-xs text-ink-secondary italic mt-2 pl-6">{q.questionAnswer}</p>
              )}
              {editable && q.status !== "DONE" && (
                <AnswerForm taskId={q.id} initialAnswer={q.questionAnswer ?? ""} />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
