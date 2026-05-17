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

  const [questions, users, customFieldDefs, suppliers, bookSections, bookSubsectionsRaw, navTags, guestGroupsRaw] = await Promise.all([
    db.task.findMany({
      where: { type: { in: ["QUESTION", "DECISION"] } },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      // v1.90.1: include the four topic m2m relations so the inline
      // edit form on /questions can pre-select existing links (parity
      // with /tasks, which already includes these on its row query).
      // Without this the edit form's TopicPicker was hidden entirely
      // because TaskForm gates the block on `bookSections.length > 0
      // || …` and we passed empty defaults.
      include: {
        bookSections:    { select: { id: true } },
        bookSubsections: { select: { id: true } },
        navTags:         { select: { id: true } },
        guestGroups:     { select: { id: true } },
        // v1.96.0: multi-assignee — include the m2m so the inline
        // edit form pre-selects the existing assignee chips.
        assignees:       { select: { id: true } },
      },
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
    // v1.30.5: book sections + nav tags for the Topics multi-select.
    // v1.58.0 (XL7): + slug for chip deep-link.
    db.bookSection.findMany({
      orderBy: { order: "asc" },
      select: { id: true, title: true, slug: true },
    }),
    // v1.51.0: subsections for the parallel card-level link picker.
    // v1.58.0 (XL7): + slug + section.slug for chip deep-link.
    db.bookSubsection.findMany({
      orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        section: { select: { title: true, slug: true } },
      },
    }),
    db.navTag.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, route: true },
    }),
    // v1.61.0 (XL1): guest groups for the Topics multi-select on
    // questions / decisions. Same shape as /tasks page loader.
    db.guestGroup.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        colour: true,
        _count: { select: { members: true } },
      },
    }),
  ]);
  const guestGroups = guestGroupsRaw.map((g) => ({
    id: g.id,
    name: g.name,
    colour: g.colour,
    memberCount: g._count.members,
  }));
  const bookSubsections = bookSubsectionsRaw.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    sectionTitle: s.section.title,
    sectionSlug: s.section.slug,
  }));
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
              bookSections={bookSections}
              bookSubsections={bookSubsections}
              navTags={navTags}
              guestGroups={guestGroups}
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
          // v1.96.0: multi-assignee — flatten the m2m to an ID list.
          assigneeIds: q.assignees.map((a) => a.id),
          dueDate: q.dueDate,
          questionAnswer: q.questionAnswer,
          notes: q.notes,
          tags: q.tags,
          customFieldValues: q.customFieldValues as Record<string, string | number | null> | null,
          // v1.90.1: flatten the m2m arrays to ID lists so the edit
          // form's TopicPicker pre-selects the existing links.
          bookSectionIds:    q.bookSections.map((s) => s.id),
          bookSubsectionIds: q.bookSubsections.map((s) => s.id),
          navTagIds:         q.navTags.map((n) => n.id),
          guestGroupIds:     q.guestGroups.map((g) => g.id),
        }))}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        editable={editable}
        customFieldDefs={customFieldDefsTyped}
        // v1.90.1: option lists for the inline edit form's TopicPicker.
        // Same shapes already loaded above for AddTaskToggle.
        bookSections={bookSections}
        bookSubsections={bookSubsections}
        navTags={navTags}
        guestGroups={guestGroups}
      />
    </>
  );
}
