import { z } from "zod";
import { db } from "@/lib/db";
import { taskUpdateSchema } from "@/lib/ai/proposals/schemas";
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
  notes: z.string().max(2000).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this update makes sense. Shown to the couple.",
    ),
});

export const proposeTaskUpdate: AiTool<typeof inputSchema> = {
  name: "propose_task_update",
  description:
    "Propose an update to an existing task. Only include the fields you want changed. Use this to suggest new due dates, promote a task's priority, or move a task's status. You MUST call read_tasks first so you have a valid taskId. Include a rationale so the couple understands why.",
  inputSchema,
  progressLabel: "Proposing task update…",
  definition: {
    name: "propose_task_update",
    description:
      "Propose an update to an existing task. Only include fields you want changed. Requires taskId from a prior read_tasks call.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "From read_tasks output." },
        title: { type: "string" },
        status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"] },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        dueDate: { type: "string", description: "ISO date (YYYY-MM-DD). Omit to leave unchanged; pass explicit null to clear." },
        notes: { type: "string" },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this update makes sense.",
        },
      },
      required: ["taskId", "rationale"],
    },
  },
  async handler(input, ctx) {
    if (!ctx.canWrite) {
      return {
        ok: false,
        error:
          "You don't have permission to write proposals. Ask the couple for ai_write access.",
      };
    }

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

    // Only send fields the AI actually populated — an "undefined" field
    // in the payload means "leave unchanged".
    const patch: Record<string, unknown> = { taskId: input.taskId };
    if (input.title !== undefined) patch.title = input.title;
    if (input.status !== undefined) patch.status = input.status;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
    if (input.notes !== undefined) patch.notes = input.notes;

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
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "task.update",
        title: `Update "${existing.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
