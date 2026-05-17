"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Priority, TaskStatus, TaskType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import {
  parseCustomFieldValue,
  mergeCustomFieldValue,
  type CustomFieldDef,
  type CustomFieldType,
  type CustomFieldValues,
} from "@/lib/custom-fields";
import { parseTopicKeys } from "@/lib/task-topics";

const baseSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.nativeEnum(TaskType).default(TaskType.TASK),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.OPEN),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // v1.28.0: optional supplier link.
  supplierId: z.string().optional().nullable(),
});

// v1.96.0: assignees moved from singular `assigneeId` (single-select)
// to multi-select `assigneeIds[]`. The form posts repeated
// `name="assigneeIds"` inputs; this helper extracts the unique non-
// empty values. Category field removed; the helper that wrote
// `tags = [category]` is gone with it (Task.tags column kept for now
// in case migrations restore semantic-category later).
// v1.96.3: shape returned by `loadTaskForEdit` — what the inline
// EditTaskDialog needs to seed TaskForm. Flattens the four m2m
// relations into ID lists so TopicPicker / AssigneePicker can
// pre-select existing chips.
export type TaskForEdit = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  notes: string | null;
  supplierId: string | null;
  tags: string[];
  customFieldValues: Record<string, string | number | null> | null;
  assigneeIds: string[];
  bookSectionIds: string[];
  bookSubsectionIds: string[];
  navTagIds: string[];
  guestGroupIds: string[];
};

/**
 * v1.96.3: fetch a single task with every relation TaskForm needs
 * pre-populated. Called by the inline EditTaskDialog on the Book
 * page's linked-tasks panels when the user clicks the per-row Edit
 * affordance — keeps the page-level query small (linked-tasks panel
 * only selects { id, title, type, status, priority, dueDate }) while
 * still letting the edit modal show the full form.
 *
 * Permission gate mirrors updateTask + setTaskStatus: TASK requires
 * EDIT(tasks); QUESTION / DECISION require EDIT(questions). Returns
 * null when the row is missing or the gate fails — caller renders
 * "Couldn't load" rather than crashing.
 */
export async function loadTaskForEdit(id: string): Promise<TaskForEdit | null> {
  const task = await db.task.findUnique({
    where: { id },
    include: {
      assignees:       { select: { id: true } },
      bookSections:    { select: { id: true } },
      bookSubsections: { select: { id: true } },
      navTags:         { select: { id: true } },
      guestGroups:     { select: { id: true } },
    },
  });
  if (!task) return null;
  // Gate by the task's type — the polymorphic table puts tasks +
  // questions + decisions in the same model. Pre-fix this leaked
  // questions through the tasks permission. Matches setTaskStatus's
  // own dispatch.
  const gate = task.type === "TASK" ? "tasks" : "questions";
  await requireEdit(gate);
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    notes: task.notes,
    supplierId: task.supplierId,
    tags: task.tags,
    customFieldValues:
      (task.customFieldValues as unknown as Record<string, string | number | null> | null) ?? null,
    assigneeIds:       task.assignees.map((a) => a.id),
    bookSectionIds:    task.bookSections.map((s) => s.id),
    bookSubsectionIds: task.bookSubsections.map((s) => s.id),
    navTagIds:         task.navTags.map((n) => n.id),
    guestGroupIds:     task.guestGroups.map((g) => g.id),
  };
}

function parseAssigneeIds(formData: FormData): string[] {
  const raw = formData.getAll("assigneeIds");
  const seen = new Set<string>();
  for (const v of raw) {
    const s = String(v).trim();
    // Form emits a `__touched__` marker so the server can distinguish
    // an empty-list assignment from "field not posted" — ignore it
    // when extracting actual IDs.
    if (s && s !== "__touched__") seen.add(s);
  }
  return [...seen];
}

function parseDue(v: FormDataEntryValue | null): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// v1.30.5 + v1.51.0 + v1.61.0: parses the Topics multi-select payload
// into four relation arrays (bookSection / bookSubsection / navTag /
// guestGroup). v1.61.1: extracted to `@/lib/task-topics` so the
// parser is unit-testable; see imports above.

export async function createTask(formData: FormData) {
  const user = await requireEdit("tasks");
  const parsed = baseSchema.parse({
    title: formData.get("title"),
    type: formData.get("type") || TaskType.TASK,
    priority: formData.get("priority") || Priority.MEDIUM,
    status: formData.get("status") || TaskStatus.OPEN,
    dueDate: formData.get("dueDate") || null,
    notes: formData.get("notes") || null,
    supplierId: formData.get("supplierId") || null,
  });
  const { bookSectionIds, bookSubsectionIds, navTagIds, guestGroupIds } = parseTopicKeys(formData);
  // v1.96.0: assigneeIds[] (multi). category dropped — was previously
  // persisted as the single-element `tags` array. The `tags` column
  // stays in the schema for now but no UI writes to it on create.
  const assigneeIds = parseAssigneeIds(formData);
  const created = await db.task.create({
    data: {
      title: parsed.title,
      type: parsed.type,
      priority: parsed.priority,
      status: parsed.status,
      dueDate: parseDue(parsed.dueDate ?? null),
      notes: parsed.notes ?? null,
      supplierId: parsed.supplierId || null,
      // v1.96.0: multi-assignee connect.
      assignees: assigneeIds.length
        ? { connect: assigneeIds.map((id) => ({ id })) }
        : undefined,
      // v1.30.5: m2m connect for the two topic relations.
      bookSections: bookSectionIds.length
        ? { connect: bookSectionIds.map((id) => ({ id })) }
        : undefined,
      // v1.51.0: parallel m2m at the card level. Independent of
      // bookSections — a task can link to a section, a card, both,
      // or neither.
      bookSubsections: bookSubsectionIds.length
        ? { connect: bookSubsectionIds.map((id) => ({ id })) }
        : undefined,
      navTags: navTagIds.length
        ? { connect: navTagIds.map((id) => ({ id })) }
        : undefined,
      // v1.61.0 (XL1): m2m to GuestGroup so tagged tasks surface on
      // every member's /guests/[id] page.
      guestGroups: guestGroupIds.length
        ? { connect: guestGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });
  // v1.30.5: enriched audit metadata per the audit-aware-feature-design
  // standing rule. Captures title, type, and the relational keys so the
  // log row reads usefully without rejoining.
  await audit(user, {
    action: "create",
    entity: "Task",
    entityId: created.id,
    metadata: {
      title: parsed.title,
      type: parsed.type,
      supplierId: parsed.supplierId || null,
      assigneeIds,
      bookSectionIds,
      bookSubsectionIds,
      navTagIds,
      guestGroupIds,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
  revalidatePath("/book");
}

export async function updateTask(id: string, formData: FormData) {
  const user = await requireEdit("tasks");
  const parsed = baseSchema.partial().parse({
    title: formData.get("title") ?? undefined,
    type: formData.get("type") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    status: formData.get("status") ?? undefined,
    dueDate: formData.get("dueDate") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    supplierId: formData.get("supplierId") ?? undefined,
  });
  const { bookSectionIds, bookSubsectionIds, navTagIds, guestGroupIds, hasTopicKeys } = parseTopicKeys(formData);
  // v1.96.0: assigneeIds[] is treated as a "set the whole list" payload,
  // mirroring the topic-keys pattern. Posted only when the form
  // explicitly emits the field — `null`-check protects partial updates
  // from blanking the assignee list.
  const hasAssigneeKeys = formData.has("assigneeIds");
  const assigneeIds = hasAssigneeKeys ? parseAssigneeIds(formData) : [];

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.type !== undefined) data.type = parsed.type;
  if (parsed.priority !== undefined) data.priority = parsed.priority;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.dueDate !== undefined) data.dueDate = parseDue(parsed.dueDate ?? null);
  if (parsed.notes !== undefined) data.notes = parsed.notes ?? null;
  if (parsed.supplierId !== undefined) data.supplierId = parsed.supplierId || null;
  if (hasAssigneeKeys) {
    data.assignees = { set: assigneeIds.map((aid) => ({ id: aid })) };
  }
  // v1.30.5: m2m `set:` replaces the relation entirely so the picker
  // can both add and remove links. Only run when the form posted any
  // topicKeys at all (`hasTopicKeys`); otherwise this is a partial
  // update that didn't touch topics.
  // v1.51.0: bookSubsections joins the same single `topicKeys` payload.
  // v1.61.0 (XL1): + guestGroups.
  if (hasTopicKeys) {
    data.bookSections = { set: bookSectionIds.map((id) => ({ id })) };
    data.bookSubsections = { set: bookSubsectionIds.map((id) => ({ id })) };
    data.navTags = { set: navTagIds.map((id) => ({ id })) };
    data.guestGroups = { set: guestGroupIds.map((id) => ({ id })) };
  }

  // v1.30.5: read pre-update for the changedFields diff in the audit.
  const before = await db.task.findUnique({
    where: { id },
    select: {
      title: true,
      type: true,
      status: true,
      priority: true,
      assignees: { select: { id: true } },
      dueDate: true,
      notes: true,
      supplierId: true,
      bookSections: { select: { id: true } },
      bookSubsections: { select: { id: true } },
      navTags: { select: { id: true } },
      guestGroups: { select: { id: true } },
    },
  });

  await db.task.update({ where: { id }, data });

  const changedFields: string[] = [];
  if (before) {
    if (parsed.title !== undefined && parsed.title !== before.title) changedFields.push("title");
    if (parsed.type !== undefined && parsed.type !== before.type) changedFields.push("type");
    if (parsed.status !== undefined && parsed.status !== before.status) changedFields.push("status");
    if (parsed.priority !== undefined && parsed.priority !== before.priority) changedFields.push("priority");
    if (hasAssigneeKeys) {
      const oldAids = before.assignees.map((a) => a.id).sort().join(",");
      const newAids = assigneeIds.slice().sort().join(",");
      if (oldAids !== newAids) changedFields.push("assignees");
    }
    if (parsed.dueDate !== undefined) {
      const newDue = parseDue(parsed.dueDate ?? null)?.getTime() ?? null;
      const oldDue = before.dueDate?.getTime() ?? null;
      if (newDue !== oldDue) changedFields.push("dueDate");
    }
    if (parsed.notes !== undefined && (parsed.notes ?? null) !== before.notes) changedFields.push("notes");
    if (parsed.supplierId !== undefined && (parsed.supplierId || null) !== before.supplierId) changedFields.push("supplierId");
    if (hasTopicKeys) {
      const oldBs = before.bookSections.map((s) => s.id).sort().join(",");
      const newBs = bookSectionIds.slice().sort().join(",");
      if (oldBs !== newBs) changedFields.push("bookSections");
      const oldBSs = before.bookSubsections.map((s) => s.id).sort().join(",");
      const newBSs = bookSubsectionIds.slice().sort().join(",");
      if (oldBSs !== newBSs) changedFields.push("bookSubsections");
      const oldNt = before.navTags.map((t) => t.id).sort().join(",");
      const newNt = navTagIds.slice().sort().join(",");
      if (oldNt !== newNt) changedFields.push("navTags");
      // v1.61.0 (XL1): + guestGroups.
      const oldGg = before.guestGroups.map((g) => g.id).sort().join(",");
      const newGg = guestGroupIds.slice().sort().join(",");
      if (oldGg !== newGg) changedFields.push("guestGroups");
    }
  }

  await audit(user, {
    action: "update",
    entity: "Task",
    entityId: id,
    metadata: {
      title: parsed.title ?? before?.title,
      type: parsed.type ?? before?.type,
      changedFields,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
  // v1.51.0: book pages render the inline tasks panel, so any
  // task edit invalidates them too.
  revalidatePath("/book");
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  // Task is a polymorphic table — TASK / QUESTION / DECISION rows live
  // here. Read the row first so we can dispatch to the right permission
  // gate. Without this, a user with EDIT(tasks) but NONE on questions
  // could change a Question's status via a crafted call.
  const task = await db.task.findUnique({ where: { id }, select: { type: true } });
  if (!task) throw new Error("Task not found");
  const section = task.type === "TASK" ? "tasks" : "questions";
  const user = await requireEdit(section);
  await db.task.update({ where: { id }, data: { status } });
  await audit(user, { action: "status", entity: "Task", entityId: id, metadata: { status, type: task.type } });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
  revalidatePath("/book", "layout");
  revalidatePath("/guests");
  revalidatePath("/songs");
  revalidatePath("/seating/ceremony");
}

export async function answerQuestion(id: string, answer: string) {
  const user = await requireEdit("questions");
  // Read before so the audit row captures the question title + whether
  // an answer was added or cleared.
  const before = await db.task.findUnique({
    where: { id },
    select: { title: true, type: true, questionAnswer: true },
  });
  await db.task.update({
    where: { id },
    data: {
      questionAnswer: answer,
      status: answer.trim() ? TaskStatus.DONE : TaskStatus.OPEN,
    },
  });
  await audit(user, {
    action: "answer",
    entity: "Task",
    entityId: id,
    metadata: {
      title: before?.title ?? null,
      type: before?.type ?? null,
      hadPreviousAnswer: !!before?.questionAnswer?.trim(),
      cleared: !answer.trim(),
      answerLength: answer.length,
    },
  });
  revalidatePath("/questions");
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  // Same polymorphic dispatch as setTaskStatus — gate by the row's type
  // rather than blanket EDIT(tasks).
  // v1.30.5: snapshot title pre-delete so the audit row reads usefully
  // after the source row is gone.
  const task = await db.task.findUnique({
    where: { id },
    select: { type: true, title: true },
  });
  if (!task) throw new Error("Task not found");
  const section = task.type === "TASK" ? "tasks" : "questions";
  const user = await requireEdit(section);
  await db.task.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "Task",
    entityId: id,
    metadata: { title: task.title, type: task.type },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
}

// ── v1.22.0: per-task custom field value writes ─────────────────────────
// Mirrors the supplier + guest equivalents. Polymorphic gate dispatches
// to either tasks or questions depending on the task's type — same
// pattern as setTaskStatus / deleteTask.

export async function setTaskCustomField(
  taskId: string,
  fieldId: string,
  rawValue: string | null,
) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { type: true, customFieldValues: true },
  });
  if (!task) throw new Error("Task not found");
  const section = task.type === "TASK" ? "tasks" : "questions";
  const user = await requireEdit(section);

  const def = await db.customField.findUnique({ where: { id: fieldId } });
  if (!def || def.entity !== "task") {
    throw new Error("Custom field not found for this entity");
  }
  const typedDef: CustomFieldDef = {
    id: def.id,
    entity: def.entity,
    name: def.name,
    type: def.type as CustomFieldType,
    options: def.options,
    order: def.order,
  };
  const value = parseCustomFieldValue(typedDef, rawValue);
  const next = mergeCustomFieldValue(
    (task.customFieldValues as CustomFieldValues | null) ?? null,
    fieldId,
    value,
  );
  await db.task.update({
    where: { id: taskId },
    data: { customFieldValues: next },
  });
  await audit(user, {
    action: "update",
    entity: "Task",
    entityId: taskId,
    metadata: { customField: def.name, fieldId, type: task.type },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
}
