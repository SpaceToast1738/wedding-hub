"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/actions";
import {
  decideOverdueTaskDigest,
  decideUnconfirmedRsvpDigest,
  sortOverdueTasksForEmail,
  type RsvpRow,
  type TaskRow,
} from "@/lib/nudge-digest";
import { formatWeddingDate, getWeddingSettings } from "@/lib/wedding-settings";

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

export type DigestKind = "rsvp" | "tasks";
export type SendResult =
  | { ok: true; sentTo: string[]; included: number }
  | { ok: false; error: string };

export type DigestPreview = {
  rsvp: { count: number; firstFew: { id: string; name: string }[] };
  tasks: {
    count: number;
    firstFew: { id: string; title: string; dueDate: Date | null }[];
  };
};

// Fetches the current digest preview — used by the Settings panel to
// show how many items would be included before the user clicks send.
// Pure read, couple-only.
export async function getDigestPreview(): Promise<DigestPreview> {
  const user = await requireUser();
  if (!user.isCouple) throw new Error("Forbidden: couple-only");
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

// HTML body for the RSVP-nudge email.
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Manually-triggered digest send. Returns a typed result; Next
// production redacts thrown errors so we route real failures through
// the result object (see v1.22.9 / v1.23.2 for the precedent).
export async function sendDigestEmail(kind: DigestKind): Promise<SendResult> {
  const user = await requireUser();
  if (!user.isCouple) {
    return { ok: false, error: "Forbidden: only the couple can send digests" };
  }

  // Recipient list = couple + planners. Read from User table.
  const recipients = await db.user.findMany({
    where: {
      OR: [{ isCouple: true }, { role: "PLANNER" }],
      email: { not: undefined },
    },
    select: { email: true },
  });
  const toAddrs = recipients.map((r) => r.email).filter(Boolean);
  if (toAddrs.length === 0) {
    return { ok: false, error: "No couple/planner accounts have an email address" };
  }

  const now = new Date();

  try {
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
      await sendOne(
        toAddrs,
        `Wedding Hub: ${eligible.length} RSVP${eligible.length === 1 ? "" : "s"} to chase`,
        rsvpDigestHtml(eligible, dateLabel, wedding.coupleLabel),
        rsvpDigestText(eligible, dateLabel, wedding.coupleLabel),
      );
      // Stamp lastNudgedAt on the included rows so they don't reappear
      // in the next 7 days.
      await db.guest.updateMany({
        where: { id: { in: eligible.map((g) => g.id) } },
        data: { lastNudgedAt: now },
      });
      await audit(user, {
        action: "send-digest",
        entity: "Nudge",
        entityId: "rsvp",
        metadata: { count: eligible.length, recipients: toAddrs },
      });
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
    await db.task.updateMany({
      where: { id: { in: eligible.map((t) => t.id) } },
      data: { lastNudgedAt: now },
    });
    await audit(user, {
      action: "send-digest",
      entity: "Nudge",
      entityId: "tasks",
      metadata: { count: eligible.length, recipients: toAddrs },
    });
    revalidatePath("/settings");
    return { ok: true, sentTo: toAddrs, included: eligible.length };
  } catch (err) {
    console.error("sendDigestEmail failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error sending digest",
    };
  }
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
