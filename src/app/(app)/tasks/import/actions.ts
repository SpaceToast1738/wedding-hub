"use server";

// v1.16.0: bulk task importer. Mirrors the guest-import flow at
// src/app/(app)/guests/import/actions.ts but with task-shaped fields.
//
// Two server actions:
//   - previewTaskImport: parses + validates without writing, returns a
//     row-by-row breakdown for the UI table.
//   - commitTaskImport: applies the rows that have no errors. Skips
//     rows with errors silently (counted in the return).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TaskType, TaskStatus, Priority } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import {
  type TaskField,
  coerceTaskDueDate,
  coerceTaskPriority,
  coerceTaskStatus,
  coerceTaskType,
  coerceTags,
  isEmptyValue,
  nonEmptyOrNull,
  parseCsv,
} from "@/lib/csv";

export type TaskImportRowPreview = {
  rowIndex: number;
  title: string;
  type: "TASK" | "QUESTION" | "DECISION";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "DONE" | "ARCHIVED";
  dueDate: string | null; // ISO; null when none parsed
  assigneeEmail: string | null;
  // After resolution against the User table at preview time:
  // - "found" → matched a user; will assign on commit
  // - "missing" → email looked valid but no User row; commit creates
  //   the task unassigned and warns the user
  // - "none" → no email column or empty value
  assigneeStatus: "found" | "missing" | "none";
  assigneeName: string | null;
  tags: string[];
  notes: string | null;
  errors: string[];
  warnings: string[];
};

export type TaskImportPreview = {
  rows: TaskImportRowPreview[];
  totalRows: number;
  validRows: number;
  rowErrors: number;
  byType: { task: number; question: number; decision: number };
};

const fieldEnum = z.enum([
  "title", "type", "priority", "status", "dueDate",
  "assigneeEmail", "tags", "notes", "ignore",
]);

const inputSchema = z.object({
  text: z.string().min(1).max(1_000_000),
  mapping: z.array(fieldEnum),
});

function findOne(mapping: TaskField[], field: TaskField): number {
  return mapping.indexOf(field);
}

function buildRowPreview(
  rawRow: string[],
  mapping: TaskField[],
  rowIndex: number,
): Omit<TaskImportRowPreview, "assigneeStatus" | "assigneeName"> {
  const get = (field: TaskField): string => {
    const idx = findOne(mapping, field);
    if (idx === -1) return "";
    return (rawRow[idx] ?? "").trim();
  };

  const title = get("title");
  const type = coerceTaskType(get("type"));
  const priority = coerceTaskPriority(get("priority"));
  const status = coerceTaskStatus(get("status"));
  const dueRaw = get("dueDate");
  const dueDate = coerceTaskDueDate(dueRaw);
  const assigneeEmailRaw = get("assigneeEmail");
  const assigneeEmail = nonEmptyOrNull(assigneeEmailRaw);
  const tagsRaw = get("tags");
  const tags = coerceTags(tagsRaw);
  const notesRaw = get("notes");
  const notes = notesRaw && !isEmptyValue(notesRaw) ? notesRaw : null;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!title) errors.push("missing title");
  if (title.length > 200) errors.push("title too long (max 200)");

  if (dueRaw && !dueDate) {
    warnings.push(`couldn't parse due date "${dueRaw}" — importing without due date`);
  }
  if (assigneeEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(assigneeEmail)) {
    warnings.push(`assignee email "${assigneeEmail}" looks malformed — importing as-is`);
  }

  return {
    rowIndex,
    title,
    type,
    priority,
    status,
    dueDate: dueDate ? dueDate.toISOString() : null,
    assigneeEmail,
    tags,
    notes,
    errors,
    warnings,
  };
}

export async function previewTaskImport(input: {
  text: string;
  mapping: TaskField[];
}): Promise<TaskImportPreview> {
  await requireEdit("tasks");
  const parsed = inputSchema.parse(input);
  const rows = parseCsv(parsed.text);
  if (rows.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      rowErrors: 0,
      byType: { task: 0, question: 0, decision: 0 },
    };
  }

  const dataRows = rows.slice(1);
  const previews = dataRows.map((row, i) =>
    buildRowPreview(row, parsed.mapping as TaskField[], i + 1),
  );

  // Resolve assignees: match emails against the User table.
  const emails = previews
    .map((p) => p.assigneeEmail)
    .filter((e): e is string => !!e);
  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, name: true, firstName: true, lastName: true },
  });
  const userByEmail = new Map(users.map((u) => [u.email, u]));

  const decorated: TaskImportRowPreview[] = previews.map((p) => {
    let assigneeStatus: "found" | "missing" | "none" = "none";
    let assigneeName: string | null = null;
    if (p.assigneeEmail) {
      const u = userByEmail.get(p.assigneeEmail);
      if (u) {
        assigneeStatus = "found";
        assigneeName = u.name ?? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email);
      } else {
        assigneeStatus = "missing";
      }
    }
    const warnings = [...p.warnings];
    if (assigneeStatus === "missing") {
      warnings.push(
        `no user with email "${p.assigneeEmail}" — importing unassigned`,
      );
    }
    return { ...p, assigneeStatus, assigneeName, warnings };
  });

  const valid = decorated.filter((p) => p.errors.length === 0);
  const byType = valid.reduce(
    (acc, p) => {
      if (p.type === "TASK") acc.task++;
      else if (p.type === "QUESTION") acc.question++;
      else if (p.type === "DECISION") acc.decision++;
      return acc;
    },
    { task: 0, question: 0, decision: 0 },
  );

  return {
    rows: decorated,
    totalRows: decorated.length,
    validRows: valid.length,
    rowErrors: decorated.length - valid.length,
    byType,
  };
}

export async function commitTaskImport(input: {
  text: string;
  mapping: TaskField[];
}): Promise<{ created: number; skipped: number; byType: { task: number; question: number; decision: number } }> {
  const user = await requireEdit("tasks");
  const parsed = inputSchema.parse(input);
  const rows = parseCsv(parsed.text);
  if (rows.length === 0) {
    return { created: 0, skipped: 0, byType: { task: 0, question: 0, decision: 0 } };
  }
  const dataRows = rows.slice(1);
  const previews = dataRows
    .map((row, i) => buildRowPreview(row, parsed.mapping as TaskField[], i + 1))
    .filter((p) => p.errors.length === 0);

  // Resolve assignees once for the whole batch.
  const emails = previews
    .map((p) => p.assigneeEmail)
    .filter((e): e is string => !!e);
  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const userIdByEmail = new Map(users.map((u) => [u.email, u.id]));

  let created = 0;
  const byType = { task: 0, question: 0, decision: 0 };
  for (const p of previews) {
    const assigneeId = p.assigneeEmail ? userIdByEmail.get(p.assigneeEmail) ?? null : null;
    await db.task.create({
      data: {
        title: p.title,
        type: TaskType[p.type],
        priority: Priority[p.priority],
        status: TaskStatus[p.status],
        dueDate: p.dueDate ? new Date(p.dueDate) : null,
        assigneeId,
        tags: p.tags,
        notes: p.notes,
      },
    });
    created++;
    if (p.type === "TASK") byType.task++;
    else if (p.type === "QUESTION") byType.question++;
    else if (p.type === "DECISION") byType.decision++;
  }

  await audit(user, {
    action: "import",
    entity: "Task",
    metadata: { created, byType, source: "csv" },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");

  return { created, skipped: dataRows.length - created, byType };
}
