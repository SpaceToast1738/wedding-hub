import { z } from "zod";
import { db } from "@/lib/db";
import { taskDeleteSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the task.delete apply handler
// (src/lib/ai/apply/deletes.ts) — a PERMANENT db delete with a
// recovery snapshot, unlike the reversible status flips the update
// tool offers.
const inputSchema = z.object({
  taskId: z
    .string()
    .min(1)
    .describe("The id of the task to delete — get this from a prior read_tasks call."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this task should be permanently deleted. Shown to the couple.",
    ),
});

export const proposeTaskDelete: AiTool<typeof inputSchema> = {
  name: "propose_task_delete",
  description:
    "Propose PERMANENTLY deleting a task, question or decision. This is destructive: applying removes the row for good (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button). Prefer propose_task_update with status DONE or ARCHIVED for finished or stale work — reserve deletion for rows that are genuinely wrong (duplicates, created by mistake). Subtasks are kept; they just lose their parent link. You MUST call read_tasks first so you have a valid taskId.",
  inputSchema,
  progressLabel: "Proposing task delete…",
  definition: {
    name: "propose_task_delete",
    description:
      "Propose permanently deleting a task/question/decision (snapshot-backed, no undo). Prefer propose_task_update status DONE/ARCHIVED where possible. Requires taskId from a prior read_tasks call.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "From read_tasks output." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this task should be deleted.",
        },
      },
      required: ["taskId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const task = await db.task.findUnique({
      where: { id: input.taskId },
      select: {
        title: true,
        type: true,
        status: true,
        _count: { select: { children: true } },
      },
    });
    if (!task) {
      return { ok: false, error: unknownIdsError([`task:${input.taskId}`]) };
    }

    const payloadResult = taskDeleteSchema.safeParse({
      taskId: input.taskId,
      targetLabel: clipDisplay(task.title, 200),
      reason: reasonFromRationale(input.rationale),
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
        kind: "task.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits = [`${task.type} · currently ${task.status}`, "permanent — snapshot kept"];
    if (task._count.children) {
      detailBits.push(`${task._count.children} subtask(s) kept but unlinked`);
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "task.delete",
        title: `Delete "${task.title}"`,
        detail: detailBits.join(" · "),
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
