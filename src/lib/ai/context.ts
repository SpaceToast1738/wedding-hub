// v2.1.0: wedding context for the AI system prompt.
//
// Injected into every AI call as part of the cached system prefix so
// the model reasons about the couple's actual data, not a generic
// wedding. Keep it small (< 1 KB) — this is the frozen prefix that
// enables prompt caching; changing it invalidates the cache for
// every subsequent request.

import { db } from "@/lib/db";
import { getWeddingSettings } from "@/lib/wedding-settings";

export type WeddingContext = {
  weddingDate: string;
  weeksToWedding: number;
  daysToWedding: number;
  venue: string;
  couple: string;
  taskCounts: {
    open: number;
    inProgress: number;
    done: number;
    overdue: number;
  };
  guestCounts: {
    invited: number;
    attending: number;
    pending: number;
    declined: number;
  };
};

export async function buildWeddingContext(): Promise<WeddingContext> {
  const settings = await getWeddingSettings();
  const now = Date.now();
  const wedTs = settings.weddingDate.getTime();
  const days = Math.max(0, Math.ceil((wedTs - now) / (24 * 60 * 60 * 1000)));

  const [taskGroups, guestGroups] = await Promise.all([
    db.task.groupBy({
      by: ["status"],
      where: { type: "TASK" },
      _count: { _all: true },
    }),
    db.guest.groupBy({
      by: ["rsvp"],
      where: { archived: false },
      _count: { _all: true },
    }),
  ]);

  const taskBy = (status: string) =>
    taskGroups.find((r) => r.status === status)?._count._all ?? 0;
  const guestBy = (rsvp: string) =>
    guestGroups.find((r) => r.rsvp === rsvp)?._count._all ?? 0;

  const overdue = await db.task.count({
    where: {
      type: "TASK",
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
      dueDate: { lt: new Date(now) },
    },
  });

  return {
    weddingDate: settings.weddingDate.toISOString().slice(0, 10),
    weeksToWedding: Math.floor(days / 7),
    daysToWedding: days,
    venue: settings.venue,
    couple: settings.coupleLabel,
    taskCounts: {
      open: taskBy("OPEN"),
      inProgress: taskBy("IN_PROGRESS"),
      done: taskBy("DONE"),
      overdue,
    },
    guestCounts: {
      invited: guestGroups.reduce((s, r) => s + r._count._all, 0),
      attending: guestBy("ATTENDING"),
      pending: guestBy("PENDING"),
      declined: guestBy("DECLINED"),
    },
  };
}

/** Render the context as a compact plain-text block for the system
 *  prompt. Deterministic key order so prompt caching stays warm. */
export function renderWeddingContext(ctx: WeddingContext): string {
  return [
    `Wedding: ${ctx.couple}`,
    `Date: ${ctx.weddingDate} at ${ctx.venue}`,
    `Time until wedding: ${ctx.daysToWedding} days (${ctx.weeksToWedding} weeks)`,
    ``,
    `Tasks: ${ctx.taskCounts.open} open, ${ctx.taskCounts.inProgress} in progress, ${ctx.taskCounts.done} done, ${ctx.taskCounts.overdue} overdue.`,
    `Guests: ${ctx.guestCounts.invited} invited, ${ctx.guestCounts.attending} attending, ${ctx.guestCounts.pending} pending, ${ctx.guestCounts.declined} declined.`,
  ].join("\n");
}
