"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TaskType, TaskStatus, Priority } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

// ── Quick-capture (the C shortcut) ────────────────────────────────────────
//
// Three target types covered: Task, Question (Task with type=QUESTION),
// and ScheduleEvent. The single text input parsed into a sensible default
// for each — title only, no priority/audience/due date upfront. The user
// edits in the destination page if they need more fields.
//
// Payments are intentionally NOT a capture type: they require a supplier +
// amount that don't fit in one text field. A "Note about a payment to do"
// can be captured as a Task instead.

const captureSchema = z.object({
  type: z.enum(["task", "question", "event"]),
  text: z.string().min(1).max(500),
});

export type QuickCaptureInput = z.infer<typeof captureSchema>;

export async function quickCapture(input: QuickCaptureInput): Promise<
  | { ok: true; type: "task" | "question" | "event"; id: string; title: string }
  | { ok: false; error: string }
> {
  const parsed = captureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Type or text invalid." };
  }
  const { type, text } = parsed.data;

  // Permission gate per type. We require edit on whichever section the
  // captured row lands in so the user can't sneak past the matrix.
  // - task / question → 'tasks' (Tasks page is shared with Questions in the nav)
  //   actually questions live under 'questions' section permission — both required.
  // - event → 'schedule'
  const section = type === "event" ? "schedule" : type === "question" ? "questions" : "tasks";
  const user = await requireEdit(section);

  if (type === "event") {
    // Default a captured event to "now + 1 hour" so it lands somewhere in
    // the Schedule view and the user can then pick a real time. We don't
    // try to parse natural-language dates here — too easy to get wrong.
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const created = await db.scheduleEvent.create({
      data: {
        title: text.trim(),
        startTime: start,
      },
    });
    await audit(user, {
      action: "quickcapture",
      entity: "ScheduleEvent",
      entityId: created.id,
      metadata: { source: "quickcapture" },
    });
    revalidatePath("/schedule");
    revalidatePath("/");
    return { ok: true, type, id: created.id, title: created.title };
  }

  // Task / Question
  const taskType = type === "question" ? TaskType.QUESTION : TaskType.TASK;
  const created = await db.task.create({
    data: {
      title: text.trim(),
      type: taskType,
      status: TaskStatus.OPEN,
      priority: Priority.MEDIUM,
      assigneeId: user.id,
    },
  });
  await audit(user, {
    action: "quickcapture",
    entity: "Task",
    entityId: created.id,
    metadata: { type: taskType, source: "quickcapture" },
  });
  revalidatePath(type === "question" ? "/questions" : "/tasks");
  revalidatePath("/");
  return { ok: true, type, id: created.id, title: created.title };
}
