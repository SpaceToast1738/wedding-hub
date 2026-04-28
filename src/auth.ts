import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { checkAndRecordAttempt } from "@/lib/rate-limit";

function allowedEmails(): string[] {
  return (process.env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string): boolean {
  return allowedEmails().includes(email.toLowerCase());
}

// Friendly "Wedding Hub" magic-link email. Inline CSS only — Gmail / Outlook /
// Apple Mail discard <style> blocks. Wrapped in a 600px table for desktop and
// stacks naturally on mobile.
function magicLinkHtml(url: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Wedding Hub sign-in</title>
  </head>
  <body style="margin:0;padding:0;background:#FBF9F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2A2620;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF9F4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E5DFD2;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 16px;border-bottom:1px solid #F1ECE2;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#3F4F30;letter-spacing:-0.01em;">Wedding Hub</div>
                <div style="font-size:12px;color:#8A8175;margin-top:4px;">Jamie &amp; Bryony · 26 September 2026</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#2A2620;line-height:1.25;">Your sign-in link</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#5C544A;">Tap the button below to open Wedding Hub. The link is valid for 24 hours and only works once.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="background:#5C7148;border-radius:8px;">
                      <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.01em;">Sign in to Wedding Hub →</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:12px;color:#8A8175;">If the button doesn't work, paste this URL into your browser:</p>
                <p style="margin:0 0 24px;font-size:12px;color:#5C7148;word-break:break-all;line-height:1.5;"><a href="${url}" style="color:#5C7148;text-decoration:underline;">${url}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid #F1ECE2;background:#FBF9F4;">
                <p style="margin:0;font-size:12px;color:#8A8175;line-height:1.55;">Didn't request this? Someone may have typed your email by mistake — you can safely ignore this message. No account is created until the link is opened.</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#8A8175;">Wedding Hub · private app for the wedding party</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function magicLinkText(url: string): string {
  return [
    "Wedding Hub — Jamie & Bryony · 26 September 2026",
    "",
    "Your sign-in link (valid 24 hours, single-use):",
    "",
    url,
    "",
    "Didn't request this? You can safely ignore this email — no account is created until the link is opened.",
  ].join("\n");
}

// First verified sign-in becomes the bootstrap admin. We define "verified"
// as having a non-null `emailVerified` (set by the magic-link flow) AND
// `isCouple = true`. While that count is zero, the next user to authenticate
// gets promoted to COUPLE so they can grant access to others via the Settings
// matrix. After that point, every new sign-in defaults to VIEWER.
async function shouldBootstrapAsCouple(): Promise<boolean> {
  const verifiedCoupleCount = await db.user.count({
    where: { isCouple: true, emailVerified: { not: null } },
  });
  return verifiedCoupleCount === 0;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Nodemailer({
      server: process.env.EMAIL_SERVER_HOST
        ? {
            host: process.env.EMAIL_SERVER_HOST,
            port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
            auth:
              process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
                ? {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.EMAIL_SERVER_PASSWORD,
                  }
                : undefined,
          }
        : { host: "localhost", port: 1025 },
      from: process.env.EMAIL_FROM ?? "noreply@localhost",
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        // Rate-limit BEFORE we check the allowlist or send anything.
        // We don't want to leak which addresses are on the allowlist by
        // having different timing for allowed/disallowed emails — but
        // we also don't want a single attacker to flood our SMTP quota
        // by hammering one allowed address. 5/hour/email is the cap;
        // see src/lib/rate-limit.ts. The decision short-circuits the
        // send and audit-logs the rejection.
        const decision = await checkAndRecordAttempt({ identifier });
        if (!decision.ok) {
          await db.auditLog
            .create({
              data: {
                action: "magic_link_rate_limited",
                entity: "MagicLinkAttempt",
                metadata: {
                  identifier,
                  reason: decision.reason,
                  retryAfterSec: decision.retryAfterSec,
                },
              },
            })
            .catch(() => undefined);
          // Throwing here surfaces a 500 to the sign-in form, which the
          // user will see as a generic error. Not ideal UX but acceptable
          // — a friendly cooldown message is a B-bucket polish item.
          throw new Error(
            `Too many sign-in attempts for this email — try again in ${decision.retryAfterSec} seconds`,
          );
        }

        if (!process.env.EMAIL_SERVER_HOST) {
          console.log(
            `\n📧 Magic link for ${identifier}\n   ${url}\n   (set EMAIL_SERVER_HOST in .env.local to send real emails)\n`,
          );
          return;
        }
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport(provider.server);
        // v1.19.5: deliverability hardening. Reply-To gives receivers
        // a real address to reply to (absence is a soft spam signal).
        // List-Unsubscribe (RFC 2369) lowers Gmail's spam-classifier
        // weight even on transactional auth mail. The Resend domain
        // auth (SPF/DKIM/DMARC on spencer-net.com) is the bigger
        // lever — see README "Email deliverability" section.
        const replyTo =
          process.env.EMAIL_REPLY_TO ?? process.env.EMAIL_FROM ?? undefined;
        const unsubscribeAddress =
          process.env.EMAIL_REPLY_TO ?? "hello@spencer-net.com";
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          replyTo,
          subject: "Your Wedding Hub sign-in link",
          text: magicLinkText(url),
          html: magicLinkHtml(url),
          headers: {
            "List-Unsubscribe": `<mailto:${unsubscribeAddress}?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email || !isAllowed(email)) return false;

      let dbUser = await db.user.findUnique({ where: { email } });

      // Bootstrap rule: while no verified couple-tier user exists, the next
      // person to come through this callback gets promoted. Handles both
      // "row already exists from seed/previous attempt" and "row about to be
      // created by the adapter" cases.
      if (await shouldBootstrapAsCouple()) {
        if (dbUser && (!dbUser.isCouple || dbUser.role !== UserRole.COUPLE)) {
          dbUser = await db.user.update({
            where: { id: dbUser.id },
            data: { isCouple: true, role: UserRole.COUPLE },
          });
        } else if (!dbUser) {
          // First-ever sign-in for this email — PrismaAdapter creates the
          // row immediately after this callback. Stamp the hint on `user`
          // so the JWT picks up couple-tier on this same session.
          user.isCouple = true;
          user.role = UserRole.COUPLE;
        }
      }

      if (dbUser) {
        user.isCouple = dbUser.isCouple;
        user.role = dbUser.role;
        user.id = dbUser.id;
      }

      return true;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await db.auditLog.create({
          data: { userId: user.id, action: "signin", entity: "user", entityId: user.id },
        });
      } catch (err) {
        console.error("audit log failed", err);
      }
    },
  },
});
