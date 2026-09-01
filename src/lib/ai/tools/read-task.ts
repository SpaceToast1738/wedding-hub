// v2.12.0: full-text read of ONE task. The companion to read_tasks,
// which clips notes to 240 chars and sets `notesTruncated`.
//
// Why it exists: `propose_task_update.notes` REPLACES the whole field.
// Combined with a 240-char clip and no way to see the rest, any notes
// edit on a long-notes task would silently destroy text the proposer
// never read — so the only safe move was to not propose at all, which
// meant stale notes could never be corrected. (Real case, 2 Aug 2026:
// the cake plan changed from three tiers to three separate cakes; two
// tasks still described tier assembly in notes that were truncated.)
// Reading the full text first makes a replacement safe.
//
// Task carries THREE unbounded @db.Text fields — notes, questionAnswer
// and decisionAnswer — and read_tasks exposes only the first two, both
// clipped. Rather than page three fields independently (three offsets,
// three page objects, one of them always relevant), `field` selects
// which one `content` carries and `textFields` reports the length of
// each so the caller knows what else is there.

import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import { pastEndError, sliceText, slicePage } from "./slice-text";
import type { AiTool } from "./types";

const TEXT_FIELDS = ["notes", "questionAnswer", "decisionAnswer"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

const inputSchema = z.object({
  taskId: z.string().min(1).max(100),
  field: z.enum(TEXT_FIELDS).optional(),
  offset: z.number().int().min(0).optional(),
});

/** Same shape read_tasks builds, so a caller can move between the two
 *  without relearning the payload. */
function resolveCustomFields(
  defs: { id: string; name: string }[],
  values: unknown,
): Record<string, string | number> | undefined {
  if (!values || typeof values !== "object") return undefined;
  const bag = values as Record<string, unknown>;
  const out: Record<string, string | number> = {};
  for (const def of defs) {
    const v = bag[def.id];
    if (typeof v === "string" && v.trim() !== "") out[def.name] = v;
    else if (typeof v === "number") out[def.name] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export const readTask: AiTool<typeof inputSchema> = {
  name: "read_task",
  description:
    "Read ONE task by id with its long text UNTRUNCATED — the companion to read_tasks, which clips notes to 240 chars and flags `notesTruncated`. Call this before any propose_task_update that changes `notes`: that field is REPLACED wholesale, so proposing a new value without having read the existing one destroys whatever you never saw. `field` picks which unbounded field to return (notes — the default — questionAnswer, or decisionAnswer); `textFields` reports the character length of all three so you know what else is there. Text over 16000 chars pages via `offset` — follow page.nextOffset until it's null.",
  inputSchema,
  progressLabel: "Reading task…",
  definition: {
    name: "read_task",
    description:
      "Read one task by id with untruncated long text. Use before propose_task_update on `notes` (that field is replaced wholesale). `field` selects notes (default) / questionAnswer / decisionAnswer; page past 16000 chars with `offset`, following page.nextOffset until null.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task id from read_tasks — never invent one." },
        field: {
          type: "string",
          enum: [...TEXT_FIELDS],
          description: "Which unbounded text field to return in `content`. Default notes.",
        },
        offset: {
          type: "integer",
          minimum: 0,
          description:
            "Character offset into the selected field (default 0). Follow page.nextOffset to read the rest.",
        },
      },
      required: ["taskId"],
    },
  },
  async handler(input, ctx) {
    // Same gate as read_tasks: ai_chat access must not bypass a NONE
    // permission on the underlying section.
    if (!(await canView(ctx.user, "tasks"))) {
      return { ok: false, error: "Tasks aren't visible to this user." };
    }

    const [task, fieldDefs] = await Promise.all([
      db.task.findUnique({
        where: { id: input.taskId },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
          notes: true,
          questionAnswer: true,
          decisionAnswer: true,
          customFieldValues: true,
          assignees: { select: { id: true, name: true, firstName: true } },
          supplier: { select: { id: true, name: true } },
          bookSections: { select: { id: true, title: true } },
          bookSubsections: { select: { id: true, title: true } },
          navTags: { select: { id: true, name: true } },
          guestGroups: { select: { id: true, name: true } },
        },
      }),
      db.customField.findMany({
        where: { entity: "task" },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    if (!task) return { ok: false, error: "No task matches that id." };

    const field: TextField = input.field ?? "notes";
    const text = task[field] ?? "";
    const offset = input.offset ?? 0;

    if (offset > 0 && offset >= text.length) {
      return { ok: false, error: pastEndError(`task "${task.title}".${field}`, offset, text.length) };
    }

    const slice = sliceText(text, offset, { toolName: "read_task" });

    const topics = {
      ...(task.bookSections.length ? { bookSections: task.bookSections } : {}),
      ...(task.bookSubsections.length ? { bookSubsections: task.bookSubsections } : {}),
      ...(task.navTags.length ? { navTags: task.navTags } : {}),
      ...(task.guestGroups.length ? { guestGroups: task.guestGroups } : {}),
    };

    return {
      ok: true,
      data: {
        id: task.id,
        title: task.title,
        type: task.type,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
        assignees: task.assignees.map((a) => a.firstName ?? a.name ?? "?"),
        supplier: task.supplier ? { id: task.supplier.id, name: task.supplier.name } : null,
        topics: Object.keys(topics).length ? topics : undefined,
        customFields: resolveCustomFields(fieldDefs, task.customFieldValues),
        // Which field `content` carries, plus the size of every long
        // field so the caller can see what it hasn't fetched.
        field,
        content: slice.content,
        page: slicePage(offset, slice, text.length),
        ...(slice.truncated ? { truncated: true } : {}),
        textFields: {
          notes: task.notes?.length ?? 0,
          questionAnswer: task.questionAnswer?.length ?? 0,
          decisionAnswer: task.decisionAnswer?.length ?? 0,
        },
      },
    };
  },
};
