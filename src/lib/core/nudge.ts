// v2.8.1 (Tier 2, Slice B): session-free core for the nudge-digest
// PREVIEW. Extracted from settings/nudge-actions.ts so the couple-only
// read_nudge_preview AI tool can answer "how many RSVPs / overdue tasks
// would a digest include right now?" without pulling next-auth into the
// isolated tool-registry module graph.
//
// PREVIEW ONLY — this file has ZERO side effects. It does not send
// email, does not stamp lastNudgedAt, and does not audit. The actual
// send stays in nudge-actions.ts behind the /settings button. (v2.8.1
// decision: nudge is preview-only for the agent — there is no
// propose_nudge, no nudge.send self-apply.)
//
// Contract (identical to the other src/lib/core/* cores): does NOT
// authenticate — every caller owns its own gate. The action wrapper in
// nudge-actions.ts keeps requireUser + isCouple; the AI tool handler
// enforces ctx.user.isCouple. Never value-import @/lib/actions here —
// that would drag @/auth (next-auth) into every consumer and break the
// tool-registry seam. (This core takes no `user` arg because the
// digest preview is a global read; the gate is the caller's job.)

import { db } from "@/lib/db";
import {
  decideOverdueTaskDigest,
  decideUnconfirmedRsvpDigest,
  sortOverdueTasksForEmail,
  type RsvpRow,
  type TaskRow,
} from "@/lib/nudge-digest";

export type DigestPreview = {
  rsvp: { count: number; firstFew: { id: string; name: string }[] };
  tasks: {
    count: number;
    firstFew: { id: string; title: string; dueDate: Date | null }[];
  };
};

/**
 * v2.8.1: extracted body of getDigestPreview (settings/nudge-actions.ts).
 * Pure read — computes the current RSVP + overdue-task digest eligibility
 * exactly as the /settings preview does, using the same pure deciders.
 * No side effects. Caller owns the couple-only gate.
 */
export async function getDigestPreviewCore(): Promise<DigestPreview> {
  const now = new Date();

  const [guestsRaw, tasksRaw] = await Promise.all([
    db.guest.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rsvp: true,
        archived: true,
        lastNudgedAt: true,
        parentGuestId: true,
      },
    }),
    db.task.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        assignees: { select: { id: true } },
        dueDate: true,
        type: true,
        lastNudgedAt: true,
      },
    }),
  ]);

  const rsvpEligible = decideUnconfirmedRsvpDigest(guestsRaw as RsvpRow[], now);
  const taskEligible = sortOverdueTasksForEmail(
    decideOverdueTaskDigest(tasksRaw as TaskRow[], now),
  );
  return {
    rsvp: {
      count: rsvpEligible.length,
      firstFew: rsvpEligible.slice(0, 5).map((g) => ({
        id: g.id,
        name: `${g.firstName} ${g.lastName}`,
      })),
    },
    tasks: {
      count: taskEligible.length,
      firstFew: taskEligible.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
      })),
    },
  };
}
