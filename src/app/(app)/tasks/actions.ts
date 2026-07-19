"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Priority, TaskStatus, TaskType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
// v2.8.0: createTask/updateTask bodies extracted to session-free cores
// so the MCP self-apply path can run the identical write logic without
// a browser session. These wrappers keep the FormData parsing + the
// requireEdit auth gate; the cores keep the db writes, audit rows and
// revalidations — human behaviour is unchanged.
import {
  createTaskCore,
  updateTaskCore,
  type TaskUpdateInput,
} from "@/lib/core/tasks";
// v2.8.0: answerQuestion + setTaskCustomField bodies also extracted to
// session-free cores so the MCP self-apply path runs identical write
// logic without a browser session. These wrappers keep the auth gate
// (setTaskCustomField's is polymorphic — derived from the task's type
// exactly as before); the cores keep the db writes, audit rows and
// revalidations.
import {
  answerQuestionCore,
  setTaskCustomFieldCore,
} from "@/lib/core/misc";
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

// v2.8.0: parseDue moved to @/lib/core/tasks with the write bodies —
// the string → Date coercion is write behaviour both the human and
// MCP self-apply paths must share.

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
  // v2.8.0: body lives in createTaskCore — db write, enriched audit
  // row, revalidations, returned id all happen there.
  return createTaskCore(user, {
    title: parsed.title,
    type: parsed.type,
    priority: parsed.priority,
    status: parsed.status,
    dueDate: parsed.dueDate,
    notes: parsed.notes,
    supplierId: parsed.supplierId,
    assigneeIds,
    bookSectionIds,
    bookSubsectionIds,
    navTagIds,
    guestGroupIds,
  });
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

  // v2.8.0: body lives in updateTaskCore. The two "was this field
  // posted at all?" FormData signals map onto the input's optionality:
  // assigneeIds/topics stay undefined (= untouched) unless the form
  // actually posted them — same partial-update semantics as before.
  const input: TaskUpdateInput = {
    title: parsed.title,
    type: parsed.type,
    priority: parsed.priority,
    status: parsed.status,
    dueDate: parsed.dueDate,
    notes: parsed.notes,
    supplierId: parsed.supplierId,
  };
  if (hasAssigneeKeys) input.assigneeIds = parseAssigneeIds(formData);
  if (hasTopicKeys) {
    input.topics = { bookSectionIds, bookSubsectionIds, navTagIds, guestGroupIds };
  }
  await updateTaskCore(user, id, input);
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
  // v2.8.0: body lives in answerQuestionCore — read-before, the
  // answer-empty status flip, enriched audit row and revalidations all
  // happen there.
  await answerQuestionCore(user, id, answer);
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
  // Polymorphic gate: read the row's type to pick tasks vs questions,
  // throwing "Task not found" before the gate exactly as before. Body
  // (def validation, typed merge, write, audit, revalidate) lives in
  // setTaskCustomFieldCore.
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { type: true },
  });
  if (!task) throw new Error("Task not found");
  const section = task.type === "TASK" ? "tasks" : "questions";
  const user = await requireEdit(section);
  await setTaskCustomFieldCore(user, taskId, fieldId, rawValue);
}
