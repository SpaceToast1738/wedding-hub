import { z } from "zod";
import { db } from "@/lib/db";
import { questionAnswerSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// `.trim().min(1)` is load-bearing beyond the payload schema's own
// min(1): answerQuestion's empty branch WIPES the stored answer and
// reopens the question, and a whitespace-only string would slip past
// a plain min(1).
const inputSchema = z.object({
  taskId: z
    .string()
    .min(1)
    .describe("The QUESTION or DECISION task id — from read_tasks with a type filter."),
  answer: z.string().trim().min(1).max(4000),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHERE this answer came from. Shown to the couple."),
});

export const proposeQuestionAnswer: AiTool<typeof inputSchema> = {
  name: "propose_question_answer",
  description:
    "Propose an answer to an open question or decision. Applying it records the answer AND marks the question Done. Only works on QUESTION or DECISION rows (use propose_task_update for plain tasks). If the question already has an answer, applying replaces it. Include a rationale saying where the answer came from.",
  inputSchema,
  progressLabel: "Proposing answer…",
  definition: {
    name: "propose_question_answer",
    description:
      "Propose an answer to a QUESTION or DECISION task. Applying records the answer AND marks the question Done, replacing any existing answer.",
    input_schema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task id of the question/decision, from read_tasks.",
        },
        answer: { type: "string", description: "The answer to record." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining where this answer came from.",
        },
      },
      required: ["taskId", "answer", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // answerQuestion itself never checks the row type — it would
    // happily stamp a questionAnswer on a plain TASK. Fence that here.
    const task = await db.task.findUnique({
      where: { id: input.taskId },
      select: { title: true, type: true, status: true, questionAnswer: true },
    });
    if (!task) {
      return { ok: false, error: unknownIdsError([`task:${input.taskId}`]) };
    }
    if (task.type !== "QUESTION" && task.type !== "DECISION") {
      return {
        ok: false,
        error: `"${task.title}" is a ${task.type}, not a question or decision — use propose_task_update for plain tasks.`,
      };
    }

    const payloadResult = questionAnswerSchema.safeParse({
      taskId: input.taskId,
      answer: input.answer,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "question.answer",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const bits: string[] = [`currently ${task.status}`];
    if (task.questionAnswer?.trim()) bits.push("replaces the current answer");

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "question.answer",
        title: `Answer "${task.title}"`,
        detail: bits.join(" · "),
        message:
          "Answer proposed. Applying it will record the answer and mark the question Done.",
      },
    };
  },
};
