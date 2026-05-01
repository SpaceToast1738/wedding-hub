import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { recordFailedGuess, VERIFY_LIMIT_MAX_PER_EMAIL } from "@/lib/rate-limit";

// v1.50.0: code-entry sign-in. Replaces the v1.20.0 "check your inbox"
// placeholder. The flow:
//   1. /signin sets a `signin-email` cookie + sends the email (which
//      now contains both a magic-link button and a 6-digit code).
//   2. User lands here; the cookie pre-fills the email, they type
//      the 6-digit code from the email.
//   3. The server action below validates the code against the
//      VerificationToken row written by Auth.js's email provider.
//      Match → redirect to /api/auth/callback/nodemailer with the
//      same token, which is the exact URL Auth.js uses for magic-
//      link clicks. So the rest of the sign-in path (session, audit,
//      bootstrap-as-couple) is identical to clicking the link.
//
// Rate limit: 5 wrong guesses per email in any 15-minute window
// blocks further attempts. See src/lib/rate-limit.ts.

const COOKIE_NAME = "signin-email";

async function verifyCode(formData: FormData) {
  "use server";

  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawCode = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!rawEmail || !rawEmail.includes("@")) {
    redirect("/signin/verify?error=invalid_email");
  }
  if (rawCode.length !== 6) {
    redirect(`/signin/verify?error=invalid_code&email=${encodeURIComponent(rawEmail)}`);
  }

  // Rate-limit guesses BEFORE consulting the DB so a burst of failed
  // attempts can't burn the verification token via the lookup overhead.
  const { checkAndRecordAttempt } = await import("@/lib/rate-limit");
  const decision = await checkAndRecordAttempt({
    identifier: rawEmail,
    bucket: "guess",
  });
  if (!decision.ok) {
    await db.auditLog
      .create({
        data: {
          action: "signin_code_rate_limited",
          entity: "VerificationToken",
          metadata: {
            email: rawEmail,
            retryAfterSec: decision.retryAfterSec,
          },
        },
      })
      .catch(() => undefined);
    redirect(
      `/signin/verify?error=rate_limited&retry=${decision.retryAfterSec}&email=${encodeURIComponent(rawEmail)}`,
    );
  }

  // Validate the code against the VerificationToken table. PrismaAdapter
  // writes one row per send keyed by (identifier, token). Match → redirect
  // to the same callback URL Auth.js builds for magic-link clicks.
  // Failed match → record + redirect with error.
  const row = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier: rawEmail, token: rawCode } },
  });
  if (!row || row.expires < new Date()) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await recordFailedGuess(rawEmail, ip);
    await db.auditLog
      .create({
        data: {
          action: "signin_code_failed",
          entity: "VerificationToken",
          entityId: rawEmail,
          metadata: {
            email: rawEmail,
            reason: row ? "expired" : "no_match",
          },
        },
      })
      .catch(() => undefined);
    redirect(
      `/signin/verify?error=bad_code&email=${encodeURIComponent(rawEmail)}`,
    );
  }

  // The code matched. Redirect to the Auth.js callback URL with the
  // same token + email — Auth.js will validate, delete the token,
  // and sign the user in. Identical to the magic-link click path.
  await db.auditLog
    .create({
      data: {
        action: "signin_code_succeeded",
        entity: "VerificationToken",
        entityId: rawEmail,
        metadata: { email: rawEmail },
      },
    })
    .catch(() => undefined);
  const callbackUrl = "/";
  const target = `/api/auth/callback/nodemailer?${new URLSearchParams({
    callbackUrl,
    token: rawCode,
    email: rawEmail,
  }).toString()}`;
  redirect(target);
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retry?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const cookieEmail = cookieStore.get(COOKIE_NAME)?.value ?? "";
  const email = sp.email ?? cookieEmail;
  const error = sp.error;
  const retry = sp.retry ? Number(sp.retry) : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="w-full max-w-sm bg-surface border border-border-soft rounded-lg shadow-md p-7">
        <div className="text-center mb-5">
          <div className="text-4xl mb-3">📬</div>
          <h1 className="font-display text-2xl font-semibold text-moss-700 mb-1">
            Check your inbox
          </h1>
          <p className="text-sm text-ink-secondary">
            Type the 6-digit code from the email — or click the magic link in
            it instead.
          </p>
        </div>

        <form action={verifyCode} className="flex flex-col gap-3">
          <label className="text-xs font-medium text-ink-secondary uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            name="email"
            defaultValue={email}
            required
            placeholder="you@example.com"
            className="text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-3 py-2 outline-none focus:border-moss-500"
          />

          <label className="text-xs font-medium text-ink-secondary uppercase tracking-wider mt-2">
            6-digit code
          </label>
          <input
            type="text"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            autoComplete="one-time-code"
            className="text-2xl font-mono tracking-[0.4em] text-center bg-surface text-ink-primary border border-border-soft rounded-sm px-3 py-2 outline-none focus:border-moss-500"
          />

          <button
            type="submit"
            className="text-sm font-medium bg-moss-500 text-white rounded-sm px-3 py-2 mt-2 hover:bg-moss-700 transition-colors"
          >
            Sign in
          </button>
        </form>

        {error === "bad_code" && (
          <p className="text-xs text-danger mt-4">
            That code doesn&apos;t match (or it&apos;s expired). Check the
            latest email — codes are 15-minute, single-use.
          </p>
        )}
        {error === "invalid_code" && (
          <p className="text-xs text-danger mt-4">
            Code must be exactly 6 digits.
          </p>
        )}
        {error === "invalid_email" && (
          <p className="text-xs text-danger mt-4">
            Please enter a valid email address.
          </p>
        )}
        {error === "rate_limited" && (
          <p className="text-xs text-danger mt-4">
            Too many attempts — try again in{" "}
            {retry && retry > 60
              ? `${Math.ceil(retry / 60)} minutes`
              : `${retry ?? "a few"} seconds`}
            . (Limit: {VERIFY_LIMIT_MAX_PER_EMAIL} attempts per 15 minutes per
            email.)
          </p>
        )}

        <p className="text-xs text-ink-tertiary mt-6 text-center">
          Didn&apos;t receive anything?{" "}
          <Link href="/signin" className="text-moss-500 underline">
            Try again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
