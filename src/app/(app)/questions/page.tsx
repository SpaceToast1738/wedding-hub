import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { AddTaskToggle } from "@/app/(app)/tasks/AddTaskToggle";
import { QuestionsClient } from "./QuestionsClient";

export default async function QuestionsPage() {
  const user = await requireUser();
  if (!(await canView(user, "questions"))) redirect("/");
  const editable = await canEdit(user, "questions");

  const [questions, users, customFieldDefs, suppliers] = await Promise.all([
    db.task.findMany({
      where: { type: { in: ["QUESTION", "DECISION"] } },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    }),
    db.user.findMany({ orderBy: [{ isCouple: "desc" }, { name: "asc" }] }),
    // v1.22.0: defs scoped to task entity (Question/Decision are
    // Task rows under the hood, so they share the "task" entity).
    db.customField.findMany({ where: { entity: "task" }, orderBy: { order: "asc" } }),
    // v1.28.0: suppliers for the optional link picker on new
    // questions/decisions (e.g. "what time will the photographer
    // arrive?" linked to that supplier).
    db.supplier.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
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

  const open = questions.filter((q) => q.status !== "DONE" && q.status !== "ARCHIVED").length;
  const answered = questions.filter((q) => q.status === "DONE").length;
  const decisionCount = questions.filter((q) => q.type === "DECISION").length;
  const questionCount = questions.length - decisionCount;

  return (
    <>
      <PageHeader
        title="Questions & Decisions"
        subtitle={`${open} open · ${answered} resolved · ${questionCount} question${questionCount === 1 ? "" : "s"} + ${decisionCount} decision${decisionCount === 1 ? "" : "s"}`}
        actions={
          editable ? (
            <AddTaskToggle
              users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
              suppliers={suppliers}
              defaultType="QUESTION"
              showType={true}
              buttonLabel="+ New"
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
          notes: q.notes,
          tags: q.tags,
          customFieldValues: q.customFieldValues as Record<string, string | number | null> | null,
        }))}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        editable={editable}
        customFieldDefs={customFieldDefsTyped}
      />
    </>
  );
}
