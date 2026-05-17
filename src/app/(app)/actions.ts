"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TaskType, TaskStatus, Priority } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit, requireUser } from "@/lib/actions";

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
  // B6 (v1.13.0): optional event start-time. Only honoured when type='event';
  // the UI exposes a `<input type="datetime-local">` so this arrives as the
  // browser-local string (no zone), which `new Date(...)` parses as local.
  startTime: z.string().optional().nullable(),
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
    // B6 (v1.13.0): use the user-supplied datetime if present (and parses
    // to a real Date); otherwise fall back to "next round hour" — the
    // pre-B6 default which is still the right answer for a one-key capture.
    const fallback = new Date();
    fallback.setMinutes(0, 0, 0);
    fallback.setHours(fallback.getHours() + 1);
    let start = fallback;
    if (parsed.data.startTime) {
      const parsedDate = new Date(parsed.data.startTime);
      if (!Number.isNaN(parsedDate.getTime())) start = parsedDate;
    }
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
      // v1.96.0: assignees m2m. Quick-capture auto-assigns to the
      // current user so the task lands "with them" by default.
      assignees: { connect: [{ id: user.id }] },
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

// ── B11: dark-mode preference ─────────────────────────────────────────────
//
// Persists per-user so the choice rides along when the user signs in on
// a new device. No permission gate — every signed-in user can set their
// own theme. The toggle UI updates localStorage in parallel so the next
// page load's pre-hydration script paints the right theme without a
// flash.

export async function setDarkModePreference(enabled: boolean): Promise<{ ok: true }> {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { darkMode: enabled },
  });
  return { ok: true };
}
