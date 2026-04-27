import { auth } from "@/auth";
import { db } from "@/lib/db";
import { StatusPill } from "@/components/ui/StatusPill";
import { redirect } from "next/navigation";

const WEDDING_ISO = process.env.WEDDING_DATE ?? "2026-09-26T14:00:00Z";

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatDue(due: Date | null): string {
  if (!due) return "no due date";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return `Overdue · ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return due.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return due.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

function priorityLabel(p: string): "HIGH" | "MED" | "LOW" {
  if (p === "HIGH" || p === "URGENT") return "HIGH";
  if (p === "MEDIUM") return "MED";
  return "LOW";
}

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;

  const [myTasks, pendingGuestCount, upcomingEvents] = await Promise.all([
    db.task.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        type: "TASK",
        OR: [{ assigneeId: userId }, { assigneeId: null }],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 8,
    }),
    db.guest.count({ where: { rsvp: "PENDING", archived: false } }),
    db.scheduleEvent.findMany({
      where: { startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
  ]);

  const days = daysUntil(WEDDING_ISO);
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-ink-primary">Today</h1>
            <div className="text-xs text-ink-tertiary mt-0.5">{today}</div>
          </div>
        </div>

        <section className="mb-6 bg-surface border border-border-soft rounded-lg p-6 flex items-center justify-between gap-6 flex-wrap shadow-sm">
          <div>
            <div className="text-xs text-ink-tertiary uppercase tracking-wider font-semibold">
              Days until the wedding
            </div>
            <div className="font-display text-5xl font-semibold text-moss-700 mt-1">
              {days}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-tertiary">26 September 2026</div>
            <div className="text-sm text-ink-secondary mt-0.5">Alveston Manor</div>
            <div className="text-sm text-ink-secondary">2:00pm ceremony</div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="md:col-span-2 bg-surface border border-border-soft rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-primary">My tasks</h2>
              <span className="text-xs text-ink-tertiary">{myTasks.length} open</span>
            </div>
            {myTasks.length === 0 ? (
              <p className="text-sm text-ink-tertiary py-6 text-center">
                Nothing on your plate. Nice.
              </p>
            ) : (
              <ul className="divide-y divide-border-soft">
                {myTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <StatusPill status={priorityLabel(t.priority)} size="sm" />
                    <span className="text-sm text-ink-primary flex-1 truncate">{t.title}</span>
                    <span className="text-xs text-ink-tertiary flex-shrink-0">{formatDue(t.dueDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-4">
            <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-ink-primary mb-2">RSVPs</h2>
              <div className="font-display text-3xl text-marigold-700 font-semibold">
                {pendingGuestCount}
              </div>
              <div className="text-xs text-ink-tertiary mt-0.5">awaiting reply</div>
            </section>

            <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-ink-primary mb-2">Upcoming</h2>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-ink-tertiary">No events scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingEvents.map((e) => (
                    <li key={e.id} className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-moss-700 w-16 flex-shrink-0">
                        {formatTime(e.startTime)}
                      </span>
                      <span className="text-xs text-ink-secondary flex-1 truncate">{e.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
