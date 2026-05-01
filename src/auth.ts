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

// v1.50.0: generate a 6-digit numeric token instead of the default
// UUID. Sign-in works two ways now:
//   (a) Click the magic link in the email — same flow as before.
//   (b) Type the 6-digit code into /signin/verify — useful when the
//       user opens the email on a different device than they're
//       signing in on, or when the email client mangles the link.
// Both routes hit the same /api/auth/callback/nodemailer endpoint
// with the same token, so the validation path is identical.
//
// Security note: a 6-digit code has a guess space of 1M, which would
// be brute-forceable without rate limits. The code TTL is reduced to
// 15 minutes (down from the 24h default) and /signin/verify enforces
// a per-email guess limit (see src/lib/rate-limit.ts).
function generateOtpToken(): string {
  // crypto.getRandomValues for unbiased uniform 0–999999. Math.random
  // is fine in practice but let's not give a future security review
  // any easy targets.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const value = buf[0]! % 1000000;
  return value.toString().padStart(6, "0");
}

// Friendly "Wedding Hub" sign-in email. Inline CSS only — Gmail / Outlook /
// Apple Mail discard <style> blocks. Wrapped in a 600px table for desktop and
// stacks naturally on mobile.
//
// v1.20.0: brideFirst / groomFirst / weddingDateLabel injected from the
// WeddingSettings singleton at send time — no env-var hardcoding.
// v1.50.0: surfaces the 6-digit code prominently above the magic-link
// button. Either path signs the user in.
function magicLinkHtml(url: string, code: string, brideFirst: string, groomFirst: string, weddingDateLabel: string): string {
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
                <div style="font-size:12px;color:#8A8175;margin-top:4px;">${brideFirst} &amp; ${groomFirst} · ${weddingDateLabel}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#2A2620;line-height:1.25;">Your sign-in code</h1>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#5C544A;">Use either option below — both sign you in. The code and link expire in 15 minutes and only work once.</p>
                <!-- v1.50.0: 6-digit code prominently displayed for typing into /signin/verify. -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
                  <tr>
                    <td style="background:#FBF9F4;border:1px solid #E5DFD2;border-radius:10px;padding:18px 28px;text-align:center;">
                      <div style="font-size:11px;color:#8A8175;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;margin-bottom:6px;">Sign-in code</div>
                      <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;color:#3F4F30;letter-spacing:0.18em;">${code}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#5C544A;">…or tap the button to sign in directly:</p>
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

function magicLinkText(url: string, code: string, brideFirst: string, groomFirst: string, weddingDateLabel: string): string {
  return [
    `Wedding Hub — ${brideFirst} & ${groomFirst} · ${weddingDateLabel}`,
    "",
    `Sign-in code: ${code}`,
    "(Type into the code-entry page; valid 15 minutes; single-use.)",
    "",
    "…or click the link instead:",
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
      // v1.50.0: 6-digit numeric code instead of UUID. Same token
      // backs both the magic link and the code-entry form on
      // /signin/verify — they hit the same callback URL with the
      // same token, so validation is identical.
      generateVerificationToken: async () => generateOtpToken(),
      // v1.50.0: 15-minute TTL (was 24h default). Six-digit codes
      // have a 1M guess space; tightening the window cuts the
      // attack surface against a brute-force guesser. Combined
      // with the per-email rate limit on /signin/verify guesses,
      // the practical attack cost stays high.
      maxAge: 15 * 60,
      sendVerificationRequest: async ({ identifier, url, token, provider }) => {
        // v1.53.0 (A3): invalidate every prior pending VerificationToken
        // for this identifier *before* the adapter writes the new row.
        // Auth.js's PrismaAdapter only deletes the matched token on
        // successful sign-in, so two consecutive sends within the
        // 15-min TTL would otherwise leave two valid 6-digit codes
        // active simultaneously. We want exactly one pending code per
        // email at any time. Run before the rate-limit pre-check so
        // a quota-blocked send still cleans up the user's previous
        // (unconsumed) code — they re-request, the older one was
        // already invalidated.
        await db.verificationToken
          .deleteMany({ where: { identifier } })
          .catch(() => undefined);

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
            `\n📧 Sign-in for ${identifier}\n   Code: ${token}\n   Link: ${url}\n   (set EMAIL_SERVER_HOST in .env.local to send real emails)\n`,
          );
          return;
        }
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport(provider.server);
        // v1.20.0: pull bride/groom names + wedding date from
        // WeddingSettings instead of hardcoded strings, so editing in
        // /settings updates the magic-link email body without a
        // redeploy.
        const { getWeddingSettings, formatWeddingDate } = await import("@/lib/wedding-settings");
        const wedding = await getWeddingSettings();
        // v1.19.5: deliverability hardening — replyTo + List-Unsubscribe.
        // Resend domain auth (SPF/DKIM/DMARC on spencer-net.com) is the
        // bigger lever; see README "Email deliverability".
        const replyTo =
          process.env.EMAIL_REPLY_TO ?? process.env.EMAIL_FROM ?? undefined;
        const unsubscribeAddress =
          process.env.EMAIL_REPLY_TO ?? "hello@spencer-net.com";
        const dateLabel = formatWeddingDate(wedding);
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          replyTo,
          subject: `Your Wedding Hub sign-in code: ${token}`,
          text: magicLinkText(url, token, wedding.brideFirst, wedding.groomFirst, dateLabel),
          html: magicLinkHtml(url, token, wedding.brideFirst, wedding.groomFirst, dateLabel),
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
