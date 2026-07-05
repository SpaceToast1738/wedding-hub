import { z } from "zod";
import { db } from "@/lib/db";
import { taskCreateSchema } from "@/lib/ai/proposals/schemas";
import { buildDetailLine, resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["TASK", "QUESTION", "DECISION"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  // v2.2.0: people + topic + supplier references. IDs come from the
  // reference directory in the system prompt (or read tools).
  assigneeIds: z.array(z.string()).max(10).optional(),
  bookSectionIds: z.array(z.string()).max(5).optional(),
  navTagIds: z.array(z.string()).max(5).optional(),
  guestGroupIds: z.array(z.string()).max(5).optional(),
  supplierId: z.string().optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this task belongs on the plan. Shown to the couple in the review UI.",
    ),
});

export const proposeTask: AiTool<typeof inputSchema> = {
  name: "propose_task",
  description:
    "Propose a new task for the couple to review. **This does NOT create the task** — it writes a proposal that the couple will Apply, Edit, or Dismiss in the review panel. Include a rationale so they understand why. Call this once per distinct task you want to add.",
  inputSchema,
  progressLabel: "Proposing task…",
  definition: {
    name: "propose_task",
    description:
      "Propose a new task for the couple to review. Writes a proposal — does not create the task directly. Include a short rationale so the couple understands why.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short imperative title, e.g. 'Confirm final headcount with venue'." },
        type: { type: "string", enum: ["TASK", "QUESTION", "DECISION"], description: "TASK by default." },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], description: "MEDIUM by default." },
        dueDate: { type: "string", description: "ISO date (YYYY-MM-DD). Optional." },
        notes: { type: "string", description: "Any extra detail to remember." },
        assigneeIds: {
          type: "array",
          items: { type: "string" },
          description:
            "User ids from the reference directory. Only assign people when the user asked for it or it's obvious who owns the task.",
        },
        bookSectionIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Wedding-book section ids from the reference directory — makes the task show up under that section.",
        },
        navTagIds: {
          type: "array",
          items: { type: "string" },
          description: "Nav tag ids from the reference directory (task topics).",
        },
        guestGroupIds: {
          type: "array",
          items: { type: "string" },
          description: "Guest group ids from the reference directory.",
        },
        supplierId: {
          type: "string",
          description: "Supplier id from read_suppliers — links the task to that vendor.",
        },
        rationale: {
          type: "string",
          description:
            "One or two sentences explaining why this task belongs on the plan. Shown to the couple.",
        },
      },
      required: ["title", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // Validate every referenced id BEFORE the proposal is written so a
    // hallucinated id can never reach the Apply path.
    const { invalid, names } = await resolveRefs({
      userIds: input.assigneeIds,
      navTagIds: input.navTagIds,
      bookSectionIds: input.bookSectionIds,
      guestGroupIds: input.guestGroupIds,
      supplierIds: input.supplierId ? [input.supplierId] : [],
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const payloadResult = taskCreateSchema.safeParse({
      title: input.title,
      type: input.type ?? "TASK",
      priority: input.priority ?? "MEDIUM",
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
      supplierId: input.supplierId ?? null,
      assigneeIds: input.assigneeIds ?? [],
      bookSectionIds: input.bookSectionIds ?? [],
      navTagIds: input.navTagIds ?? [],
      guestGroupIds: input.guestGroupIds ?? [],
    });
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "task.create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detail = buildDetailLine({
      assignees: (input.assigneeIds ?? []).map((id) => names.users.get(id)!),
      topics: [
        ...(input.navTagIds ?? []).map((id) => names.navTags.get(id)!),
        ...(input.bookSectionIds ?? []).map((id) => names.bookSections.get(id)!),
        ...(input.guestGroupIds ?? []).map((id) => names.guestGroups.get(id)!),
      ],
      supplier: input.supplierId ? names.suppliers.get(input.supplierId) : null,
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "task.create",
        title: input.title,
        detail,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
