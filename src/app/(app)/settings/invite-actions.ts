"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireCouple } from "@/lib/actions";
import { UserRole } from "@prisma/client";
import { getWeddingSettings, formatWeddingDate } from "@/lib/wedding-settings";

const inviteSchema = z.object({
  email: z.string().email("Valid email required").toLowerCase(),
  role: z.enum(["WEDDING_PARTY", "PLANNER", "VIEWER"]).default("VIEWER"),
  isCouple: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
});

export type InviteResult = { ok: true } | { ok: false; error: string };

export async function createInvite(formData: FormData): Promise<InviteResult> {
  const actor = await requireCouple();
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    isCouple: formData.get("isCouple"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, role, isCouple } = parsed.data;

  // Don't invite someone already in the system.
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "That email already has an account. Edit their permissions in the Members panel." };
  }

  // Upsert: if a revoked/expired invite exists, reopen it.
  await db.invite.upsert({
    where: { email },
    create: { email, role: role as UserRole, isCouple, invitedById: actor.id },
    update: { role: role as UserRole, isCouple, status: "PENDING", invitedById: actor.id, acceptedAt: null },
  });

  await logAudit({
    userId: actor.id,
    action: "invite-created",
    entity: "Invite",
    entityId: email,
    metadata: { email, role, isCouple },
  });

  // Send invite email via the same Nodemailer transport used for sign-in.
  await sendInviteEmail(email, actor.id).catch((err) =>
    console.error("invite email failed", err),
  );

  revalidatePath("/settings");
  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<InviteResult> {
  const actor = await requireCouple();
  const invite = await db.invite.findUnique({ where: { id: inviteId }, select: { email: true, status: true } });
  if (!invite) return { ok: false, error: "Invite not found" };
  if (invite.status !== "PENDING") return { ok: false, error: "Only pending invites can be revoked" };

  await db.invite.update({ where: { id: inviteId }, data: { status: "REVOKED" } });
  await logAudit({
    userId: actor.id,
    action: "invite-revoked",
    entity: "Invite",
    entityId: inviteId,
    metadata: { email: invite.email },
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function resendInvite(inviteId: string): Promise<InviteResult> {
  const actor = await requireCouple();
  const invite = await db.invite.findUnique({ where: { id: inviteId }, select: { email: true, status: true } });
  if (!invite) return { ok: false, error: "Invite not found" };
  if (invite.status !== "PENDING") return { ok: false, error: "Only pending invites can be resent" };

  await sendInviteEmail(invite.email, actor.id).catch((err) =>
    console.error("resend invite email failed", err),
  );

  await logAudit({
    userId: actor.id,
    action: "invite-resent",
    entity: "Invite",
    entityId: inviteId,
    metadata: { email: invite.email },
  });

  return { ok: true };
}

async function sendInviteEmail(toEmail: string, actorId: string) {
  if (!process.env.EMAIL_SERVER_HOST) {
    console.log(`\n📧 Invite for ${toEmail} — go to ${process.env.AUTH_URL ?? "http://localhost:3000"}/signin to sign in\n`);
    return;
  }
  const [wedding, actor] = await Promise.all([
    getWeddingSettings(),
    db.user.findUnique({ where: { id: actorId }, select: { firstName: true, name: true } }),
  ]);
  const inviterName = actor?.firstName ?? actor?.name ?? "The wedding team";
  const dateLabel = formatWeddingDate(wedding);
  const signInUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/signin`;

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
      ? { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD }
      : undefined,
  });

  await transport.sendMail({
    to: toEmail,
    from: process.env.EMAIL_FROM ?? "noreply@localhost",
    subject: `You've been invited to Wedding Hub`,
    text: [
      `${inviterName} has invited you to Wedding Hub — the private planning app for ${wedding.brideFirst} & ${wedding.groomFirst}'s wedding on ${dateLabel}.`,
      "",
      `Sign in at: ${signInUrl}`,
      "",
      "Enter your email address to receive a sign-in code.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><title>Wedding Hub invite</title></head>
<body style="margin:0;padding:0;background:#FBF9F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2A2620;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF9F4;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E5DFD2;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:32px 32px 16px;border-bottom:1px solid #F1ECE2;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#3F4F30;">Wedding Hub</div>
        <div style="font-size:12px;color:#8A8175;margin-top:4px;">${wedding.brideFirst} &amp; ${wedding.groomFirst} · ${dateLabel}</div>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#2A2620;">You&rsquo;re invited</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#5C544A;">${inviterName} has invited you to <strong>Wedding Hub</strong> — the private planning app for ${wedding.brideFirst} &amp; ${wedding.groomFirst}&rsquo;s wedding on ${dateLabel}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr><td style="background:#5C7148;border-radius:8px;">
            <a href="${signInUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Sign in to Wedding Hub →</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:12px;color:#8A8175;">Enter <strong>${toEmail}</strong> on the sign-in page to receive your code.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
  });
}
