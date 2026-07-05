import { z } from "zod";
import { db } from "@/lib/db";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/ai/proposals/schemas";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Breakdown = N existing-kind proposals in one batch, no new kind:
// one task.create per subtask (+ an optional task.update parking the
// parent WAITING). The shared batchId groups them into a single
// approve-all card on /ai, and the rationale marker
// "[breakdown:<parentId>]" is the duplicate fence — a second breakdown
// for the same parent is refused while one is still PENDING.
const inputSchema = z.object({
  parentTaskId: z
    .string()
    .min(1)
    .describe("The id of the task to break down — get this from a prior read_tasks call."),
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        dueDate: z.string().optional().nullable().describe("ISO date (YYYY-MM-DD)."),
        notes: z.string().max(2000).optional().nullable(),
        assigneeIds: z.array(z.string()).max(10).optional(),
      }),
    )
    .min(2)
    .max(10),
  markParentWaiting: z.boolean().optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this breakdown helps. Shown on every subtask's review card.",
    ),
});

export const proposeTaskBreakdown: AiTool<typeof inputSchema> = {
  name: "propose_task_breakdown",
  description:
    "Break a big task into 2–10 subtask proposals in one reviewable batch. Use for any task too big to action in one sitting. Subtasks inherit the parent's supplier + topics automatically — don't re-specify them. Optionally parks the parent as WAITING while the subtasks land. Does NOT create anything directly — the couple reviews the whole batch. You MUST call read_tasks first so you have a valid parentTaskId.",
  inputSchema,
  progressLabel: "Proposing task breakdown…",
  definition: {
    name: "propose_task_breakdown",
    description:
      "Propose breaking one task into 2–10 subtasks (one batch of proposals). Subtasks inherit the parent's supplier and topics automatically. Optionally parks the parent as WAITING. Requires parentTaskId from a prior read_tasks call.",
    input_schema: {
      type: "object",
      properties: {
        parentTaskId: { type: "string", description: "From read_tasks output." },
        subtasks: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Short imperative title, e.g. 'Shortlist three florists'.",
              },
              priority: {
                type: "string",
                enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
                description: "MEDIUM by default.",
              },
              dueDate: { type: "string", description: "ISO date (YYYY-MM-DD). Optional." },
              notes: { type: "string", description: "Any extra detail to remember." },
              assigneeIds: {
                type: "array",
                items: { type: "string" },
                description:
                  "User ids from the reference directory. Only assign when it's obvious who owns the step.",
              },
            },
            required: ["title"],
          },
          description: "The ordered steps. Each becomes its own task proposal.",
        },
        markParentWaiting: {
          type: "boolean",
          description:
            "Also propose parking the parent task as WAITING while the subtasks are worked through.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this breakdown helps.",
        },
      },
      required: ["parentTaskId", "subtasks", "rationale"],
    },
  },
  async handler(input, ctx) {
    // n=0: canWrite check only. The real N-slot reservation happens
    // AFTER all validation — reserving up front would burn up to 11
    // of the turn's slots on a refusal (duplicate fence, bad refs)
    // that never created anything.
    const guard = takeProposalSlots(ctx, 0);
    if (guard) return guard;
    const n = input.subtasks.length + (input.markParentWaiting ? 1 : 0);

    // Load the parent server-side including supplier + all four topic
    // relations — read_tasks doesn't surface these, so inheritance has
    // to come from the live row, not from the model.
    const parent = await db.task.findUnique({
      where: { id: input.parentTaskId },
      select: {
        id: true,
        title: true,
        supplierId: true,
        bookSections: { select: { id: true } },
        bookSubsections: { select: { id: true } },
        navTags: { select: { id: true } },
        guestGroups: { select: { id: true } },
      },
    });
    if (!parent) {
      return {
        ok: false,
        error: `No task with id '${input.parentTaskId}'. Call read_tasks to get the correct id.`,
      };
    }

    const { invalid, names } = await resolveRefs({
      userIds: input.subtasks.flatMap((s) => s.assigneeIds ?? []),
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // Duplicate fence: Task has no unique constraints, so a re-run
    // would happily queue a second identical set of subtasks. The
    // rationale marker is the only propose-time trace of the parent.
    const marker = `[breakdown:${input.parentTaskId}]`;
    const existing = await db.aiProposal.findFirst({
      where: {
        status: "PENDING",
        kind: "task.create",
        rationale: { startsWith: marker },
      },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: false,
        error:
          "A breakdown for this task is already awaiting review. Ask the user to review the pending batch on /ai before proposing another.",
      };
    }

    // Validate every payload BEFORE creating anything, so a bad
    // subtask can't leave a half-written batch behind.
    const subtaskPayloads: object[] = [];
    for (const st of input.subtasks) {
      const parsed = taskCreateSchema.safeParse({
        title: st.title,
        type: "TASK",
        status: "OPEN",
        priority: st.priority ?? "MEDIUM",
        dueDate: st.dueDate ?? null,
        notes: st.notes ?? null,
        supplierId: parent.supplierId,
        assigneeIds: st.assigneeIds ?? [],
        bookSectionIds: parent.bookSections.map((s) => s.id),
        bookSubsectionIds: parent.bookSubsections.map((s) => s.id),
        navTagIds: parent.navTags.map((t) => t.id),
        guestGroupIds: parent.guestGroups.map((g) => g.id),
      });
      if (!parsed.success) {
        return {
          ok: false,
          error: `Subtask "${st.title}" failed validation: ${parsed.error.message}`,
        };
      }
      subtaskPayloads.push(parsed.data as unknown as object);
    }

    // Parking the parent is status-only, never notes: read_tasks
    // truncates notes, so a notes write here would overwrite text the
    // model never saw.
    let parentPayload: object | null = null;
    if (input.markParentWaiting) {
      const parsed = taskUpdateSchema.safeParse({
        taskId: input.parentTaskId,
        status: "WAITING",
      });
      if (!parsed.success) {
        return {
          ok: false,
          error: `Parent update failed validation: ${parsed.error.message}`,
        };
      }
      parentPayload = parsed.data as unknown as object;
    }

    // Everything validated — now reserve the batch's slots.
    const slotGuard = takeProposalSlots(ctx, n);
    if (slotGuard) return slotGuard;

    const batchId = ctx.batchId ?? null;
    const proposals = await db.$transaction([
      ...subtaskPayloads.map((payload) =>
        db.aiProposal.create({
          data: {
            createdById: ctx.user.id,
            kind: "task.create",
            payload,
            rationale: `${marker} ${input.rationale}`,
            batchId,
          },
        }),
      ),
      ...(parentPayload
        ? [
            db.aiProposal.create({
              data: {
                createdById: ctx.user.id,
                kind: "task.update",
                payload: parentPayload,
                rationale: `${marker} Parent parked WAITING while the subtasks land.`,
                batchId,
              },
            }),
          ]
        : []),
    ]);

    const assigneeNames = [
      ...new Set(
        input.subtasks.flatMap((s) => (s.assigneeIds ?? []).map((id) => names.users.get(id)!)),
      ),
    ];

    // Per-proposal entries so the chat loop can emit one
    // proposal_created event each — the panel then renders its normal
    // batch card with inline Apply/Dismiss, same as any other batch.
    const proposalEntries = proposals.map((p, i) => ({
      proposalId: p.id,
      kind: i < input.subtasks.length ? "task.create" : "task.update",
      title:
        i < input.subtasks.length
          ? input.subtasks[i]!.title
          : `Park "${parent.title}" as WAITING`,
    }));

    return {
      ok: true,
      data: {
        proposalIds: proposals.map((p) => p.id),
        proposals: proposalEntries,
        count: proposals.length,
        title: `Broke down "${parent.title}" into ${input.subtasks.length} subtasks`,
        detail: assigneeNames.length ? `→ ${assigneeNames.join(", ")}` : undefined,
        message: input.markParentWaiting
          ? "Breakdown proposed as one batch (subtasks + parking the parent as WAITING). The couple can approve it all in one click on /ai."
          : "Breakdown proposed as one batch. The couple can approve it all in one click on /ai.",
      },
    };
  },
};
