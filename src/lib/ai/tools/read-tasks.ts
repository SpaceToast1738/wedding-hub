import { z } from "zod";
import { db } from "@/lib/db";
import type { AiTool } from "./types";

const TASK_STATUS = ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"] as const;
const TASK_TYPE = ["TASK", "QUESTION", "DECISION"] as const;
const PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const inputSchema = z.object({
  status: z.enum(TASK_STATUS).optional(),
  type: z.enum(TASK_TYPE).optional(),
  priority: z.enum(PRIORITY).optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  overdue: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

function trimNotes(notes: string | null): string | null {
  if (!notes) return null;
  return notes.length > 240 ? notes.slice(0, 240) + "…" : notes;
}

export const readTasks: AiTool<typeof inputSchema> = {
  name: "read_tasks",
  description:
    "Read tasks (or questions or decisions) matching the given filters. Use this before making task suggestions so you don't propose duplicates. Returns the most recent 20 by default; ask for more with `limit`. Set `overdue: true` to fetch just tasks whose due date has passed.",
  inputSchema,
  progressLabel: "Reading tasks…",
  definition: {
    name: "read_tasks",
    description:
      "Read tasks (or questions or decisions) matching the given filters. Use this before making task suggestions so you don't propose duplicates. Returns the most recent 20 by default; ask for more with `limit`. Set `overdue: true` to fetch just tasks whose due date has passed.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...TASK_STATUS], description: "Filter by status." },
        type: { type: "string", enum: [...TASK_TYPE], description: "TASK (default), QUESTION, or DECISION." },
        priority: { type: "string", enum: [...PRIORITY] },
        dueBefore: { type: "string", description: "ISO date. Return tasks with dueDate before this." },
        dueAfter: { type: "string", description: "ISO date. Return tasks with dueDate after this." },
        overdue: { type: "boolean", description: "Shortcut: tasks with dueDate < now and status != DONE/ARCHIVED." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20." },
      },
    },
  },
  async handler(input) {
    const where: Record<string, unknown> = {};
    if (input.status) where.status = input.status;
    if (input.type) where.type = input.type;
    if (input.priority) where.priority = input.priority;
    if (input.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { in: ["OPEN", "IN_PROGRESS", "WAITING"] };
    } else if (input.dueBefore || input.dueAfter) {
      const range: Record<string, Date> = {};
      if (input.dueBefore) range.lt = new Date(input.dueBefore);
      if (input.dueAfter) range.gt = new Date(input.dueAfter);
      where.dueDate = range;
    }

    const tasks = await db.task.findMany({
      where,
      take: input.limit ?? 20,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        priority: true,
        dueDate: true,
        notes: true,
        assignees: { select: { id: true, name: true, firstName: true } },
      },
    });

    return {
      ok: true,
      data: {
        count: tasks.length,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
          notes: trimNotes(t.notes),
          assignees: t.assignees.map((a) => a.firstName ?? a.name ?? "?"),
        })),
      },
    };
  },
};
