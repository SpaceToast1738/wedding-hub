// v1.25.0: pure decision module for the nudge-digest emails.
//
// "Nudges" are couple-and-planner-facing reminders — never sent to
// guests (admin-only standing rule). The decisions here pick which
// items go into a given digest based on RSVP/status, due-date, and
// the per-row `lastNudgedAt` rate-limit.
//
// All functions are pure: take a snapshot of the rows + a `now` Date,
// return what should land in the digest. The server-action layer
// handles fetching, sending, audit, and writing back `lastNudgedAt`.
// Keeping these pure makes the decision matrix trivially unit-testable
// without DB or SMTP setup (mirrors `src/lib/csv-merge.ts`).

const NUDGE_COOLDOWN_DAYS = 7;
const NUDGE_COOLDOWN_MS = NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

// Returns true if the row hasn't been nudged in at least
// NUDGE_COOLDOWN_DAYS — i.e. it's eligible to land in a fresh digest.
export function nudgeEligible(lastNudgedAt: Date | null, now: Date): boolean {
  if (lastNudgedAt === null) return true;
  return now.getTime() - lastNudgedAt.getTime() >= NUDGE_COOLDOWN_MS;
}

// Shape we accept for the RSVP digest. Keeps this module independent
// of Prisma's generated Guest type — caller maps from Prisma to this
// shape (and back when writing lastNudgedAt).
export type RsvpRow = {
  id: string;
  firstName: string;
  lastName: string;
  rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  archived: boolean;
  lastNudgedAt: Date | null;
  // Plus-ones don't get separately surfaced in the digest — they
  // resolve with their host. Filter them out when building the input.
  parentGuestId: string | null;
};

// Pick guests whose RSVP is PENDING (or MAYBE — both are "haven't
// committed yet"), aren't archived, aren't a +1 (those follow the
// host), and haven't been nudged recently.
export function decideUnconfirmedRsvpDigest(
  guests: RsvpRow[],
  now: Date,
): RsvpRow[] {
  return guests.filter((g) => {
    if (g.archived) return false;
    if (g.parentGuestId !== null) return false; // +1 — host carries the nudge
    if (g.rsvp !== "PENDING" && g.rsvp !== "MAYBE") return false;
    if (!nudgeEligible(g.lastNudgedAt, now)) return false;
    return true;
  });
}

// Shape we accept for the overdue-task digest.
export type TaskRow = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "ARCHIVED";
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  assigneeId: string | null;
  dueDate: Date | null;
  type: "TASK" | "QUESTION" | "DECISION";
  lastNudgedAt: Date | null;
};

// Pick TASKs (not questions / decisions — those go elsewhere) that
// are past their due date, still open / in-progress / blocked, and
// haven't been nudged recently.
export function decideOverdueTaskDigest(
  tasks: TaskRow[],
  now: Date,
): TaskRow[] {
  return tasks.filter((t) => {
    if (t.type !== "TASK") return false;
    if (t.status === "DONE" || t.status === "ARCHIVED") return false;
    if (t.dueDate === null) return false;
    if (t.dueDate.getTime() >= now.getTime()) return false;
    if (!nudgeEligible(t.lastNudgedAt, now)) return false;
    return true;
  });
}

// Sort priority for the rendered email body. URGENT first, then HIGH,
// then by due-date ascending (most overdue at the top). Pure helper.
export function sortOverdueTasksForEmail<T extends TaskRow>(tasks: T[]): T[] {
  const rank = (p: TaskRow["priority"]) =>
    p === "URGENT" ? 0 : p === "HIGH" ? 1 : p === "MEDIUM" ? 2 : 3;
  return [...tasks].sort((a, b) => {
    const r = rank(a.priority) - rank(b.priority);
    if (r !== 0) return r;
    const ad = a.dueDate?.getTime() ?? Infinity;
    const bd = b.dueDate?.getTime() ?? Infinity;
    return ad - bd;
  });
}
