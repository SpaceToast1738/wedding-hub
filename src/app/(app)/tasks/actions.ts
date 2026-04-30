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

const baseSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.nativeEnum(TaskType).default(TaskType.TASK),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.OPEN),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // v1.28.0: optional supplier link.
  supplierId: z.string().optional().nullable(),
});

function parseDue(v: FormDataEntryValue | null): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// v1.30.5: split the Topics multi-select payload into the two relation
// arrays. The form posts one `topicKeys` entry per selected topic with
// values like `bookSection:<id>` or `navTag:<id>`.
function parseTopicKeys(formData: FormData): {
  bookSectionIds: string[];
  navTagIds: string[];
  hasTopicKeys: boolean;
} {
  // Detect "no topicKeys field at all" vs. "explicitly empty selection"
  // — different semantics for the partial-update path on updateTask.
  const hasTopicKeys = formData.has("topicKeys");
  const keys = formData.getAll("topicKeys").map(String);
  const bookSectionIds: string[] = [];
  const navTagIds: string[] = [];
  for (const k of keys) {
    if (k.startsWith("bookSection:")) bookSectionIds.push(k.slice("bookSection:".length));
    else if (k.startsWith("navTag:")) navTagIds.push(k.slice("navTag:".length));
  }
  return { bookSectionIds, navTagIds, hasTopicKeys };
}

export async function createTask(formData: FormData) {
  const user = await requireEdit("tasks");
  const parsed = baseSchema.parse({
    title: formData.get("title"),
    type: formData.get("type") || TaskType.TASK,
    priority: formData.get("priority") || Priority.MEDIUM,
    status: formData.get("status") || TaskStatus.OPEN,
    assigneeId: formData.get("assigneeId") || null,
    dueDate: formData.get("dueDate") || null,
    category: formData.get("category") || null,
    notes: formData.get("notes") || null,
    supplierId: formData.get("supplierId") || null,
  });
  const { bookSectionIds, navTagIds } = parseTopicKeys(formData);
  const tags = parsed.category ? [parsed.category] : [];
  const created = await db.task.create({
    data: {
      title: parsed.title,
      type: parsed.type,
      priority: parsed.priority,
      status: parsed.status,
      assigneeId: parsed.assigneeId || null,
      dueDate: parseDue(parsed.dueDate ?? null),
      tags,
      notes: parsed.notes ?? null,
      supplierId: parsed.supplierId || null,
      // v1.30.5: m2m connect for the two topic relations.
      bookSections: bookSectionIds.length
        ? { connect: bookSectionIds.map((id) => ({ id })) }
        : undefined,
      navTags: navTagIds.length
        ? { connect: navTagIds.map((id) => ({ id })) }
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
      bookSectionIds,
      navTagIds,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
}

export async function updateTask(id: string, formData: FormData) {
  const user = await requireEdit("tasks");
  const parsed = baseSchema.partial().parse({
    title: formData.get("title") ?? undefined,
    type: formData.get("type") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    status: formData.get("status") ?? undefined,
    assigneeId: formData.get("assigneeId") ?? undefined,
    dueDate: formData.get("dueDate") ?? undefined,
    category: formData.get("category") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    supplierId: formData.get("supplierId") ?? undefined,
  });
  const { bookSectionIds, navTagIds, hasTopicKeys } = parseTopicKeys(formData);

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.type !== undefined) data.type = parsed.type;
  if (parsed.priority !== undefined) data.priority = parsed.priority;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.assigneeId !== undefined) data.assigneeId = parsed.assigneeId || null;
  if (parsed.dueDate !== undefined) data.dueDate = parseDue(parsed.dueDate ?? null);
  if (parsed.category !== undefined) data.tags = parsed.category ? [parsed.category] : [];
  if (parsed.notes !== undefined) data.notes = parsed.notes ?? null;
  if (parsed.supplierId !== undefined) data.supplierId = parsed.supplierId || null;
  // v1.30.5: m2m `set:` replaces the relation entirely so the picker
  // can both add and remove links. Only run when the form posted any
  // topicKeys at all (`hasTopicKeys`); otherwise this is a partial
  // update that didn't touch topics.
  if (hasTopicKeys) {
    data.bookSections = { set: bookSectionIds.map((id) => ({ id })) };
    data.navTags = { set: navTagIds.map((id) => ({ id })) };
  }

  // v1.30.5: read pre-update for the changedFields diff in the audit.
  const before = await db.task.findUnique({
    where: { id },
    select: {
      title: true,
      type: true,
      status: true,
      priority: true,
      assigneeId: true,
      dueDate: true,
      tags: true,
      notes: true,
      supplierId: true,
      bookSections: { select: { id: true } },
      navTags: { select: { id: true } },
    },
  });

  await db.task.update({ where: { id }, data });

  const changedFields: string[] = [];
  if (before) {
    if (parsed.title !== undefined && parsed.title !== before.title) changedFields.push("title");
    if (parsed.type !== undefined && parsed.type !== before.type) changedFields.push("type");
    if (parsed.status !== undefined && parsed.status !== before.status) changedFields.push("status");
    if (parsed.priority !== undefined && parsed.priority !== before.priority) changedFields.push("priority");
    if (parsed.assigneeId !== undefined && (parsed.assigneeId || null) !== before.assigneeId) changedFields.push("assigneeId");
    if (parsed.dueDate !== undefined) {
      const newDue = parseDue(parsed.dueDate ?? null)?.getTime() ?? null;
      const oldDue = before.dueDate?.getTime() ?? null;
      if (newDue !== oldDue) changedFields.push("dueDate");
    }
    if (parsed.category !== undefined) {
      const newCat = parsed.category || null;
      const oldCat = before.tags[0] ?? null;
      if (newCat !== oldCat) changedFields.push("category");
    }
    if (parsed.notes !== undefined && (parsed.notes ?? null) !== before.notes) changedFields.push("notes");
    if (parsed.supplierId !== undefined && (parsed.supplierId || null) !== before.supplierId) changedFields.push("supplierId");
    if (hasTopicKeys) {
      const oldBs = before.bookSections.map((s) => s.id).sort().join(",");
      const newBs = bookSectionIds.slice().sort().join(",");
      if (oldBs !== newBs) changedFields.push("bookSections");
      const oldNt = before.navTags.map((t) => t.id).sort().join(",");
      const newNt = navTagIds.slice().sort().join(",");
      if (oldNt !== newNt) changedFields.push("navTags");
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
