import { z } from "zod";
import { db } from "@/lib/db";
import { taskUpdateSchema } from "@/lib/ai/proposals/schemas";
import { buildDetailLine, resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import { DEFAULT_SLICE_CHARS } from "./slice-text";
import type { AiTool } from "./types";

const inputSchema = z.object({
  taskId: z
    .string()
    .min(1)
    .describe(
      "The id of the task to update — get this from a prior read_tasks call.",
    ),
  title: z.string().min(1).max(200).optional(),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional().describe("ISO date (YYYY-MM-DD)."),
  // v2.12.0: raised from the house-standard 2000 to the read page size.
  // `notes` REPLACES the field, so a lossless rewrite has to be able to
  // carry back everything read_task just handed over — at 2000 a task
  // with 2500 chars of notes was readable but not rewritable, which is
  // the same read/write asymmetry this enhancement set out to close.
  // The invariant: anything readable in one page is writable in one
  // proposal. Other propose_* tools keep 2000 — none of them have a
  // paired full-text read.
  notes: z.string().max(DEFAULT_SLICE_CHARS).optional(),
  // v2.4.3: link/unlink the task's supplier — the gap the planner
  // itself reported ("task linking isn't something I can do").
  // undefined = untouched, null = unlink, id = link.
  supplierId: z.string().optional().nullable(),
  // v2.2.0: assignee + topic deltas. Applied as a merge against the
  // task's live relations at Apply time — safe under concurrent edits.
  addAssigneeIds: z.array(z.string()).max(10).optional(),
  removeAssigneeIds: z.array(z.string()).max(10).optional(),
  addNavTagIds: z.array(z.string()).max(5).optional(),
  removeNavTagIds: z.array(z.string()).max(5).optional(),
  addBookSectionIds: z.array(z.string()).max(5).optional(),
  removeBookSectionIds: z.array(z.string()).max(5).optional(),
  // v2.6.2: card-level links — a specific Wedding Book subsection, not
  // the whole section. Ids come from read_book with a sectionSlug.
  addBookSubsectionIds: z.array(z.string()).max(5).optional(),
  removeBookSubsectionIds: z.array(z.string()).max(5).optional(),
  addGuestGroupIds: z.array(z.string()).max(5).optional(),
  removeGuestGroupIds: z.array(z.string()).max(5).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this update makes sense. Shown to the couple.",
    ),
});

const idArray = (description: string) => ({
  type: "array" as const,
  items: { type: "string" as const },
  description,
});

export const proposeTaskUpdate: AiTool<typeof inputSchema> = {
  name: "propose_task_update",
  description:
    "Propose an update to an existing task — field changes, and/or adding/removing assignees and topics. Only include what you want changed; add/remove lists are deltas merged against the task's current state at apply time. You MUST call read_tasks first so you have a valid taskId. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing task update…",
  definition: {
    name: "propose_task_update",
    description:
      "Propose an update to an existing task. Only include fields you want changed; assignee/topic changes are add/remove deltas. Requires taskId from a prior read_tasks call.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "From read_tasks output." },
        title: { type: "string" },
        status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"] },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        dueDate: { type: "string", description: "ISO date (YYYY-MM-DD)." },
        notes: {
          type: "string",
          description:
            "REPLACES the entire notes field — it is not appended to. Call read_task first and carry forward anything worth keeping, otherwise text you never saw is destroyed (read_tasks clips notes at 240 chars).",
        },
        supplierId: {
          type: ["string", "null"],
          description:
            "Supplier id from read_suppliers — links the task to that vendor. Pass null to unlink. Omit to leave unchanged.",
        },
        addAssigneeIds: idArray("User ids (reference directory) to ADD as assignees."),
        removeAssigneeIds: idArray("User ids to REMOVE from assignees."),
        addNavTagIds: idArray("Nav tag ids to add as topics."),
        removeNavTagIds: idArray("Nav tag ids to remove."),
        addBookSectionIds: idArray("Wedding-book section ids to add as topics."),
        removeBookSectionIds: idArray("Wedding-book section ids to remove."),
        addBookSubsectionIds: idArray(
          "Wedding-book CARD ids to link (a specific card inside a section, not the whole section) — call read_book with a sectionSlug first to get card ids. Use this when the user names a specific card.",
        ),
        removeBookSubsectionIds: idArray("Wedding-book card ids to unlink."),
        addGuestGroupIds: idArray("Guest group ids to add as topics."),
        removeGuestGroupIds: idArray("Guest group ids to remove."),
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this update makes sense.",
        },
      },
      required: ["taskId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const existing = await db.task.findUnique({
      where: { id: input.taskId },
      select: { id: true, title: true },
    });
    if (!existing) {
      return {
        ok: false,
        error: `No task with id '${input.taskId}'. Call read_tasks to get the correct id.`,
      };
    }

    // Validate every referenced id — including removals, so a typo'd
    // remove doesn't silently no-op and mislead the reviewer.
    const { invalid, names } = await resolveRefs({
      userIds: [...(input.addAssigneeIds ?? []), ...(input.removeAssigneeIds ?? [])],
      navTagIds: [...(input.addNavTagIds ?? []), ...(input.removeNavTagIds ?? [])],
      bookSectionIds: [
        ...(input.addBookSectionIds ?? []),
        ...(input.removeBookSectionIds ?? []),
      ],
      subsectionIds: [
        ...(input.addBookSubsectionIds ?? []),
        ...(input.removeBookSubsectionIds ?? []),
      ],
      guestGroupIds: [
        ...(input.addGuestGroupIds ?? []),
        ...(input.removeGuestGroupIds ?? []),
      ],
      supplierIds: typeof input.supplierId === "string" ? [input.supplierId] : [],
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // Only send fields the AI actually populated — an "undefined" field
    // in the payload means "leave unchanged".
    const patch: Record<string, unknown> = { taskId: input.taskId };
    if (input.title !== undefined) patch.title = input.title;
    if (input.status !== undefined) patch.status = input.status;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.supplierId !== undefined) patch.supplierId = input.supplierId;
    for (const key of [
      "addAssigneeIds",
      "removeAssigneeIds",
      "addNavTagIds",
      "removeNavTagIds",
      "addBookSectionIds",
      "removeBookSectionIds",
      "addBookSubsectionIds",
      "removeBookSubsectionIds",
      "addGuestGroupIds",
      "removeGuestGroupIds",
    ] as const) {
      if (input[key]?.length) patch[key] = input[key];
    }

    // A patch with only taskId would create an empty "small tweak"
    // proposal the reviewer can't do anything with — reject it.
    if (Object.keys(patch).length === 1) {
      return {
        ok: false,
        error:
          "The update contains no changes. Include at least one field to change (title, status, priority, dueDate, notes, or an add/remove list).",
      };
    }

    const payloadResult = taskUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "task.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const addedAssignees = (input.addAssigneeIds ?? []).map((id) => names.users.get(id)!);
    const removedAssignees = (input.removeAssigneeIds ?? []).map(
      (id) => `−${names.users.get(id)!}`,
    );
    const detail = buildDetailLine({
      assignees: [...addedAssignees, ...removedAssignees],
      supplier:
        typeof input.supplierId === "string"
          ? names.suppliers.get(input.supplierId)
          : input.supplierId === null
            ? "(unlinked)"
            : null,
      topics: [
        ...(input.addNavTagIds ?? []).map((id) => `+${names.navTags.get(id)!}`),
        ...(input.removeNavTagIds ?? []).map((id) => `−${names.navTags.get(id)!}`),
        ...(input.addBookSectionIds ?? []).map((id) => `+${names.bookSections.get(id)!}`),
        ...(input.removeBookSectionIds ?? []).map((id) => `−${names.bookSections.get(id)!}`),
        ...(input.addBookSubsectionIds ?? []).map((id) => `+${names.subsections.get(id)!}`),
        ...(input.removeBookSubsectionIds ?? []).map((id) => `−${names.subsections.get(id)!}`),
        ...(input.addGuestGroupIds ?? []).map((id) => `+${names.guestGroups.get(id)!}`),
        ...(input.removeGuestGroupIds ?? []).map((id) => `−${names.guestGroups.get(id)!}`),
      ],
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "task.update",
        title: `Update "${existing.title}"`,
        detail,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
