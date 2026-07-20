"use server";

import { requireUser } from "@/lib/actions";
import {
  getDigestPreviewCore,
  sendDigestCore,
  type DigestKind,
  type SendResult,
} from "@/lib/core/nudge";

// v1.25.0: nudge digest emails. Sent to the couple + planners (admin-
// only standing rule — never to guests). Manually triggered from
// Settings; the cron variant is deferred to a future release.
//
// Two kinds:
//   - "rsvp"   — guests still PENDING/MAYBE, not nudged in 7+ days.
//   - "tasks"  — tasks past their due date, not nudged in 7+ days.
//
// Returns a typed result rather than throwing (production redaction
// pattern, see v1.22.9 / v1.23.2).
//
// v2.8.1: the preview shape + read logic moved to src/lib/core/nudge.ts
// (session-free) so the couple-only read_nudge_preview AI tool can reuse
// it without pulling next-auth into the tool-registry graph.
// v2.9.2: the SEND machinery (digest builders, recipient lookup,
// eligibility → send → stamp → audit) also moved to the core so the
// proposal-gated propose_nudge_send / nudge.send apply path can send
// over token auth. These wrappers are now thin gate-then-delegate.
// Re-exported types keep existing importers (NudgesPanel) resolving.

export type { DigestKind, SendResult };
export type { DigestPreview } from "@/lib/core/nudge";

// Fetches the current digest preview — used by the Settings panel to
// show how many items would be included before the user clicks send.
// Pure read, couple-only. Thin wrapper: gate here, delegate the read to
// the extracted core.
export async function getDigestPreview() {
  const user = await requireUser();
  if (!user.isCouple) throw new Error("Forbidden: couple-only");
  return getDigestPreviewCore();
}

// Manually-triggered digest send. Returns a typed result; Next
// production redacts thrown errors so we route real failures through
// the result object (see v1.22.9 / v1.23.2 for the precedent). The
// core sends the email first, then stamps + audits best-effort — a
// bookkeeping failure after a successful send resolves as `ok` (the
// email went out), so a re-click can't double-send.
export async function sendDigestEmail(kind: DigestKind): Promise<SendResult> {
  const user = await requireUser();
  if (!user.isCouple) {
    return { ok: false, error: "Forbidden: only the couple can send digests" };
  }
  try {
    return await sendDigestCore(user, kind);
  } catch (err) {
    console.error("sendDigestEmail failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error sending digest",
    };
  }
}
