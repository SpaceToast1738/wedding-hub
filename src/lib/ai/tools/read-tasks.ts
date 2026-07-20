import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
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
  titleContains: z.string().max(120).optional(),
  // v2.9.2: filter by assignee — a user id (exact) OR a case-insensitive
  // substring of their name / first name. Lets the agent enumerate "what
  // is Josh on the hook for?" without pulling every task.
  assignee: z.string().max(120).optional(),
  // v2.9.2: offset pagination (mirrors read_seating / read_budget). Follow
  // nextOffset until it's null to enumerate all matches past the 50-cap.
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

function trimNotes(notes: string | null): string | null {
  if (!notes) return null;
  return notes.length > 240 ? notes.slice(0, 240) + "…" : notes;
}

/** Resolve a row's `customFieldValues` Json (keyed by CustomField.id)
 *  to { fieldName: value }. Keys whose def has been deleted are
 *  dropped; empty result → undefined so serialized output doesn't
 *  carry a `customFields: {}` per row. */
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

export const readTasks: AiTool<typeof inputSchema> = {
  name: "read_tasks",
  description:
    "Read tasks (or questions or decisions) matching the given filters. Use this before making task suggestions so you don't propose duplicates. Returns the most recent 20 by default; ask for more with `limit` (max 50). To enumerate ALL matches (the hub has 90+ open tasks), page with `offset` — follow the returned page.nextOffset until it's null. Filter to one person's workload with `assignee` (their user id, or a substring of their name). Set `overdue: true` to fetch just tasks whose due date has passed. Each task carries its supplier link, topic links (book sections/cards, nav tags, guest groups), and resolved custom fields — the ids in those are real and usable in propose_task_update.",
  inputSchema,
  progressLabel: "Reading tasks…",
  definition: {
    name: "read_tasks",
    description:
      "Read tasks (or questions or decisions) matching the given filters. Returns the most recent 20 by default; `limit` (max 50) + `offset` page through the rest — follow page.nextOffset until null. `assignee` filters to one person (user id or name substring). Set `overdue: true` for tasks whose due date has passed. Each task carries its supplier link, topic links, and resolved custom fields.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...TASK_STATUS], description: "Filter by status." },
        type: { type: "string", enum: [...TASK_TYPE], description: "TASK (default), QUESTION, or DECISION." },
        priority: { type: "string", enum: [...PRIORITY] },
        dueBefore: { type: "string", description: "ISO date. Return tasks with dueDate before this." },
        dueAfter: { type: "string", description: "ISO date. Return tasks with dueDate after this." },
        overdue: { type: "boolean", description: "Shortcut: tasks with dueDate < now and status != DONE/ARCHIVED." },
        titleContains: { type: "string", description: "Case-insensitive substring match on the title." },
        assignee: { type: "string", description: "Assignee filter: a user id, or a case-insensitive substring of their name / first name." },
        offset: { type: "integer", minimum: 0, description: "Skip this many matches (default 0). Follow page.nextOffset to paginate." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20." },
      },
    },
  },
  async handler(input, ctx) {
    // v2.4.0 review fix: the section gate — ai_chat access alone must
    // not bypass a NONE permission on the underlying section.
    if (!(await canView(ctx.user, "tasks"))) {
      return { ok: false, error: "Tasks aren't visible to this user." };
    }
    const where: Record<string, unknown> = {};
    if (input.status) where.status = input.status;
    if (input.type) where.type = input.type;
    if (input.priority) where.priority = input.priority;
    if (input.titleContains) {
      where.title = { contains: input.titleContains, mode: "insensitive" };
    }
    if (input.assignee) {
      // Match a user id exactly OR a case-insensitive substring of their
      // name / first name — one filter covers "user:<id>" precision and
      // "Josh" convenience.
      const a = input.assignee.trim();
      if (a) {
        where.assignees = {
          some: {
            OR: [
              { id: a },
              { name: { contains: a, mode: "insensitive" } },
              { firstName: { contains: a, mode: "insensitive" } },
            ],
          },
        };
      }
    }
    if (input.overdue) {
      where.dueDate = { lt: new Date() };
      // Intersect with an explicit status filter instead of silently
      // overwriting it — {status: "WAITING", overdue: true} means
      // "overdue WAITING tasks", not "all overdue tasks".
      if (input.status && ["OPEN", "IN_PROGRESS", "WAITING"].includes(input.status)) {
        where.status = input.status;
      } else if (input.status) {
        return {
          ok: false,
          error: `overdue:true only applies to open statuses — ${input.status} tasks can't be overdue.`,
        };
      } else {
        where.status = { in: ["OPEN", "IN_PROGRESS", "WAITING"] };
      }
    } else if (input.dueBefore || input.dueAfter) {
      const range: Record<string, Date> = {};
      // Validate before Prisma sees them — Invalid Date throws a raw
      // engine error the model can't act on.
      if (input.dueBefore) {
        const d = new Date(input.dueBefore);
        if (isNaN(d.getTime())) {
          return { ok: false, error: `Invalid dueBefore date: ${input.dueBefore}. Use ISO format.` };
        }
        range.lt = d;
      }
      if (input.dueAfter) {
        const d = new Date(input.dueAfter);
        if (isNaN(d.getTime())) {
          return { ok: false, error: `Invalid dueAfter date: ${input.dueAfter}. Use ISO format.` };
        }
        range.gt = d;
      }
      where.dueDate = range;
    }

    const offset = input.offset ?? 0;
    const limit = input.limit ?? 20;

    const [tasks, fieldDefs, total] = await Promise.all([
      db.task.findMany({
        where,
        skip: offset,
        take: limit,
        // id is the final tiebreaker so offset pagination is stable
        // across pages (dueDate/updatedAt alone can tie).
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
          notes: true,
          questionAnswer: true,
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
      db.task.count({ where }),
    ]);

    const nextOffset = offset + limit < total ? offset + limit : null;

    return {
      ok: true,
      data: {
        count: tasks.length,
        page: { offset, limit, total, nextOffset },
        tasks: tasks.map((t) => {
          // Topic sub-lists only when non-empty — most tasks have no
          // topics and 20 × 4 empty arrays is pure token waste.
          const topics = {
            ...(t.bookSections.length ? { bookSections: t.bookSections } : {}),
            ...(t.bookSubsections.length ? { bookSubsections: t.bookSubsections } : {}),
            ...(t.navTags.length ? { navTags: t.navTags } : {}),
            ...(t.guestGroups.length ? { guestGroups: t.guestGroups } : {}),
          };
          return {
            id: t.id,
            title: t.title,
            type: t.type,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
            notes: trimNotes(t.notes),
            notesTruncated: (t.notes?.length ?? 0) > 240,
            questionAnswer: trimNotes(t.questionAnswer),
            assignees: t.assignees.map((a) => a.firstName ?? a.name ?? "?"),
            supplier: t.supplier ? { id: t.supplier.id, name: t.supplier.name } : null,
            topics: Object.keys(topics).length ? topics : undefined,
            customFields: resolveCustomFields(fieldDefs, t.customFieldValues),
          };
        }),
      },
    };
  },
};
