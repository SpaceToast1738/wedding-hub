// v2.8.1 (Tier 2, Slice B): session-free core for the nudge-digest
// PREVIEW. Extracted from settings/nudge-actions.ts so the couple-only
// read_nudge_preview AI tool can answer "how many RSVPs / overdue tasks
// would a digest include right now?" without pulling next-auth into the
// isolated tool-registry module graph.
//
// v2.9.2: the SEND machinery moved here too (from nudge-actions.ts) so
// the proposal-gated propose_nudge_send / nudge.send apply path can send
// the digest over token auth, where no Auth.js session exists. The
// digest HTML/text builders, the recipient lookup, the eligibility →
// send → stamp → audit pipeline and the nodemailer transport all live
// here; the "use server" wrapper (sendDigestEmail) is now a thin
// gate-then-delegate. IMPORTANT for idempotency: sendDigestCore sends
// the email FIRST, then does the lastNudgedAt stamp + audit as
// best-effort (a post-send failure is logged, never thrown) — so a
// caller that re-runs after a bookkeeping hiccup can't double-send.
// The apply engine's atomic PENDING→APPLIED claim is the primary
// double-send guard; this ordering is the belt-and-braces.
//
// Contract (identical to the other src/lib/core/* cores): does NOT
// authenticate — every caller owns its own gate. The action wrapper in
// nudge-actions.ts keeps requireUser + isCouple; the AI tool handler
// enforces ctx.user.isCouple; the AI apply path re-checks isCouple.
// Never value-import @/lib/actions here — that would drag @/auth
// (next-auth) into every consumer and break the tool-registry seam.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
// Type-only import — erased at compile time, so this module never pulls
// the @/auth graph into the MCP route bundle (same convention as
// src/lib/core/*).
import type { SessionUser } from "@/lib/actions";
import { formatWeddingDate, getWeddingSettings } from "@/lib/wedding-settings";
import {
  decideOverdueTaskDigest,
  decideUnconfirmedRsvpDigest,
  sortOverdueTasksForEmail,
  type RsvpRow,
  type TaskRow,
} from "@/lib/nudge-digest";

export type DigestKind = "rsvp" | "tasks";

export type DigestPreview = {
  rsvp: { count: number; firstFew: { id: string; name: string }[] };
  tasks: {
    count: number;
    firstFew: { id: string; title: string; dueDate: Date | null }[];
  };
};

export type SendResult =
  | { ok: true; sentTo: string[]; included: number }
  | { ok: false; error: string };

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

// v2.9.2: recipient lookup — the couple + planners (admin-only standing
// rule; NEVER guests). Shared by sendDigestCore and by
// propose_nudge_send, which snapshots the list so the /ai reviewer sees
// exactly who gets emailed.
export async function getDigestRecipientsCore(): Promise<string[]> {
  const recipients = await db.user.findMany({
    where: {
      OR: [{ isCouple: true }, { role: "PLANNER" }],
      email: { not: undefined },
    },
    select: { email: true },
  });
  return recipients.map((r) => r.email).filter(Boolean);
}

// ── Digest email bodies (moved verbatim from nudge-actions.ts) ─────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rsvpDigestHtml(
  guests: RsvpRow[],
  weddingDateLabel: string,
  coupleLabel: string,
): string {
  const rows = guests
    .map(
      (g) =>
        `<li style="margin: 4px 0;"><strong>${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}</strong> &mdash; <span style="color:#8a6a14;">${g.rsvp.toLowerCase()}</span></li>`,
    )
    .join("");
  return `<!DOCTYPE html><html><body style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 580px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px; margin: 0 0 4px 0;">RSVPs to chase</h1>
  <p style="color:#666; font-size: 13px; margin: 0 0 18px 0;">${escapeHtml(coupleLabel)} &middot; ${escapeHtml(weddingDateLabel)}</p>
  <p style="font-size: 14px; line-height: 1.5;">${guests.length} guest${guests.length === 1 ? "" : "s"} still ${guests.length === 1 ? "hasn't" : "haven't"} confirmed:</p>
  <ul style="font-size: 14px; line-height: 1.6; padding-left: 20px;">${rows}</ul>
  <p style="font-size: 12px; color:#666; margin-top: 24px;">Sent from Wedding Hub. Each guest will only appear once per 7 days.</p>
</body></html>`;
}

function rsvpDigestText(
  guests: RsvpRow[],
  weddingDateLabel: string,
  coupleLabel: string,
): string {
  const rows = guests
    .map((g) => `  - ${g.firstName} ${g.lastName} (${g.rsvp.toLowerCase()})`)
    .join("\n");
  return `RSVPs to chase
${coupleLabel} · ${weddingDateLabel}

${guests.length} guest${guests.length === 1 ? "" : "s"} still ${guests.length === 1 ? "hasn't" : "haven't"} confirmed:

${rows}

—
Sent from Wedding Hub. Each guest will only appear once per 7 days.`;
}

function tasksDigestHtml(
  tasks: TaskRow[],
  weddingDateLabel: string,
  coupleLabel: string,
): string {
  const rows = tasks
    .map((t) => {
      const dueLabel = t.dueDate ? t.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "no date";
      return `<li style="margin: 4px 0;"><strong>${escapeHtml(t.title)}</strong> &mdash; <span style="color:#a14545;">${dueLabel}</span> &middot; ${t.priority.toLowerCase()}</li>`;
    })
    .join("");
  return `<!DOCTYPE html><html><body style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 580px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px; margin: 0 0 4px 0;">Overdue tasks</h1>
  <p style="color:#666; font-size: 13px; margin: 0 0 18px 0;">${escapeHtml(coupleLabel)} &middot; ${escapeHtml(weddingDateLabel)}</p>
  <p style="font-size: 14px; line-height: 1.5;">${tasks.length} task${tasks.length === 1 ? "" : "s"} ${tasks.length === 1 ? "is" : "are"} past due:</p>
  <ul style="font-size: 14px; line-height: 1.6; padding-left: 20px;">${rows}</ul>
  <p style="font-size: 12px; color:#666; margin-top: 24px;">Sent from Wedding Hub. Each task will only appear once per 7 days.</p>
</body></html>`;
}

function tasksDigestText(
  tasks: TaskRow[],
  weddingDateLabel: string,
  coupleLabel: string,
): string {
  const rows = tasks
    .map((t) => {
      const dueLabel = t.dueDate ? t.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "no date";
      return `  - ${t.title} (due ${dueLabel}, ${t.priority.toLowerCase()})`;
    })
    .join("\n");
  return `Overdue tasks
${coupleLabel} · ${weddingDateLabel}

${tasks.length} task${tasks.length === 1 ? "" : "s"} past due:

${rows}

—
Sent from Wedding Hub. Each task will only appear once per 7 days.`;
}

async function sendOne(
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  // Mirror the auth.ts nodemailer setup: dynamic import so the
  // module isn't loaded into the edge runtime, dev-friendly fallback
  // when no SMTP host is configured.
  if (!process.env.EMAIL_SERVER_HOST) {
    console.log(
      `\n📧 Digest email (no SMTP configured)\n   to: ${to.join(", ")}\n   subject: ${subject}\n   ${text.split("\n").slice(0, 5).join("\n   ")}\n   …\n`,
    );
    return;
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth:
      process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
        ? {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          }
        : undefined,
  });
  const replyTo = process.env.EMAIL_REPLY_TO ?? process.env.EMAIL_FROM ?? undefined;
  const unsubscribeAddress =
    process.env.EMAIL_REPLY_TO ?? "hello@spencer-net.com";
  await transport.sendMail({
    to: to.join(", "),
    from: process.env.EMAIL_FROM ?? "Wedding Hub <noreply@spencer-net.com>",
    replyTo,
    subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<mailto:${unsubscribeAddress}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

// v2.9.2: session-free digest SEND. Recomputes eligibility from live
// data (so the 7-day cooldown is always honoured and nobody who has
// since RSVP'd / closed their task gets chased), sends the email, then
// stamps lastNudgedAt + audits BEST-EFFORT (post-send failures are
// logged, not thrown — the email already went, so the caller must not
// re-send). A send-transport failure DOES throw (nothing stamped yet,
// safe to retry). Caller owns the couple-only gate.
export async function sendDigestCore(
  user: SessionUser,
  kind: DigestKind,
): Promise<SendResult> {
  const toAddrs = await getDigestRecipientsCore();
  if (toAddrs.length === 0) {
    return { ok: false, error: "No couple/planner accounts have an email address" };
  }

  const now = new Date();

  if (kind === "rsvp") {
    const guestsRaw = await db.guest.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rsvp: true,
        archived: true,
        lastNudgedAt: true,
        parentGuestId: true,
      },
    });
    const eligible = decideUnconfirmedRsvpDigest(guestsRaw as RsvpRow[], now);
    if (eligible.length === 0) {
      return { ok: false, error: "Nothing to send — no eligible guests right now" };
    }
    const wedding = await getWeddingSettings();
    const dateLabel = formatWeddingDate(wedding);
    // Send FIRST — a transport failure throws before anything is stamped.
    await sendOne(
      toAddrs,
      `Wedding Hub: ${eligible.length} RSVP${eligible.length === 1 ? "" : "s"} to chase`,
      rsvpDigestHtml(eligible, dateLabel, wedding.coupleLabel),
      rsvpDigestText(eligible, dateLabel, wedding.coupleLabel),
    );
    await stampAndAudit(user, "rsvp", eligible.map((g) => g.id), toAddrs, () =>
      db.guest.updateMany({
        where: { id: { in: eligible.map((g) => g.id) } },
        data: { lastNudgedAt: now },
      }),
    );
    revalidatePath("/settings");
    return { ok: true, sentTo: toAddrs, included: eligible.length };
  }

  // kind === "tasks"
  const tasksRaw = await db.task.findMany({
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
  });
  const eligible = sortOverdueTasksForEmail(
    decideOverdueTaskDigest(tasksRaw as TaskRow[], now),
  );
  if (eligible.length === 0) {
    return { ok: false, error: "Nothing to send — no overdue tasks right now" };
  }
  const wedding = await getWeddingSettings();
  const dateLabel = formatWeddingDate(wedding);
  await sendOne(
    toAddrs,
    `Wedding Hub: ${eligible.length} overdue task${eligible.length === 1 ? "" : "s"}`,
    tasksDigestHtml(eligible, dateLabel, wedding.coupleLabel),
    tasksDigestText(eligible, dateLabel, wedding.coupleLabel),
  );
  await stampAndAudit(user, "tasks", eligible.map((t) => t.id), toAddrs, () =>
    db.task.updateMany({
      where: { id: { in: eligible.map((t) => t.id) } },
      data: { lastNudgedAt: now },
    }),
  );
  revalidatePath("/settings");
  return { ok: true, sentTo: toAddrs, included: eligible.length };
}

/** Post-send bookkeeping — stamp lastNudgedAt on the included rows so
 *  they respect the 7-day cooldown, and write the send audit. BEST
 *  EFFORT: the email already went out by the time we get here, so a
 *  failure is logged and swallowed, never thrown (throwing would make
 *  the caller re-send). */
async function stampAndAudit(
  user: SessionUser,
  entityId: DigestKind,
  includedIds: string[],
  recipients: string[],
  stamp: () => Promise<unknown>,
): Promise<void> {
  try {
    await stamp();
    await logAudit({
      userId: user.id,
      action: "send-digest",
      entity: "Nudge",
      entityId,
      metadata: { count: includedIds.length, recipients },
    });
  } catch (err) {
    console.error("nudge digest post-send bookkeeping failed", err);
  }
}
