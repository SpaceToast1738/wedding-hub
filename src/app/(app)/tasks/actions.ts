"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Priority, TaskStatus, TaskType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const baseSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.nativeEnum(TaskType).default(TaskType.TASK),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.OPEN),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function parseDue(v: FormDataEntryValue | null): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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
  });
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
    },
  });
  await audit(user, { action: "create", entity: "Task", entityId: created.id });
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
  });
  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.type !== undefined) data.type = parsed.type;
  if (parsed.priority !== undefined) data.priority = parsed.priority;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.assigneeId !== undefined) data.assigneeId = parsed.assigneeId || null;
  if (parsed.dueDate !== undefined) data.dueDate = parseDue(parsed.dueDate ?? null);
  if (parsed.category !== undefined) data.tags = parsed.category ? [parsed.category] : [];
  if (parsed.notes !== undefined) data.notes = parsed.notes ?? null;

  await db.task.update({ where: { id }, data });
  await audit(user, { action: "update", entity: "Task", entityId: id });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const user = await requireEdit("tasks");
  await db.task.update({ where: { id }, data: { status } });
  await audit(user, { action: "status", entity: "Task", entityId: id, metadata: { status } });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
}

export async function answerQuestion(id: string, answer: string) {
  const user = await requireEdit("questions");
  await db.task.update({
    where: { id },
    data: {
      questionAnswer: answer,
      status: answer.trim() ? TaskStatus.DONE : TaskStatus.OPEN,
    },
  });
  await audit(user, { action: "answer", entity: "Task", entityId: id });
  revalidatePath("/questions");
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const user = await requireEdit("tasks");
  await db.task.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "Task", entityId: id });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
}
