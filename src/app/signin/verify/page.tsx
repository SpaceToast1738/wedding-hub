import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  checkGuessLimit,
  recordFailedGuess,
  VERIFY_LIMIT_MAX_PER_EMAIL,
} from "@/lib/rate-limit";

// v1.50.0: code-entry sign-in. Replaces the v1.20.0 "check your inbox"
// placeholder. The flow:
//   1. /signin sets a `signin-email` cookie + sends the email (which
//      now contains both a magic-link button and a 6-digit code).
//   2. User lands here; the cookie carries the email server-side. They
//      type the 6-digit code from the email.
//   3. The server action below validates the code against the
//      VerificationToken row written by Auth.js's email provider.
//      Match → redirect to /api/auth/callback/nodemailer with the
//      same token, which is the exact URL Auth.js uses for magic-
//      link clicks. So the rest of the sign-in path (session, audit,
//      bootstrap-as-couple) is identical to clicking the link.
//
// Rate limit: 5 wrong guesses per email in any 15-minute window
// blocks further attempts. See src/lib/rate-limit.ts.
//
// v1.53.0 (A2): the email is read from the **httpOnly cookie**, not
// a form field. Pre-fix, an attacker could rotate the form-supplied
// email across known allowlisted addresses to brute-force 5 guesses
// each per 15 min × N emails — and burn legit users' lockout
// budgets in the process. Now: form has no email field; the cookie
// is the source of truth. Cookie absent → redirect to /signin.
//
// v1.53.0 (A1): the rate-limit pre-check is read-only via
// `checkGuessLimit`; only `recordFailedGuess` writes a row, and only
// on a failed match. The legacy double-count (pre-check + on-fail)
// reduced the effective budget to 2–3 wrong guesses; now it's a
// real 5.

const COOKIE_NAME = "signin-email";

async function verifyCode(formData: FormData) {
  "use server";

  // v1.53.0 (A2): email comes from the httpOnly cookie set by
  // /signin's server action. The form no longer carries an email
  // input. If the cookie is missing or expired (15-min TTL), the
  // user has to re-request a code — bounce them back to /signin.
  const cookieStore = await cookies();
  const email = (cookieStore.get(COOKIE_NAME)?.value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    redirect("/signin?error=expired");
  }

  const rawCode = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (rawCode.length !== 6) {
    redirect(`/signin/verify?error=invalid_code`);
  }

  // Rate-limit guesses BEFORE consulting the DB so a burst of failed
  // attempts can't burn the verification token via the lookup overhead.
  // v1.53.0 (A1): read-only check — only failed guesses below
  // record a row. Successful matches consume nothing.
  const decision = await checkGuessLimit(email);
  if (!decision.ok) {
    await db.auditLog
      .create({
        data: {
          action: "signin_code_rate_limited",
          entity: "VerificationToken",
          metadata: {
            email,
            retryAfterSec: decision.retryAfterSec,
          },
        },
      })
      .catch(() => undefined);
    redirect(
      `/signin/verify?error=rate_limited&retry=${decision.retryAfterSec}`,
    );
  }

  // Validate the code against the VerificationToken table. PrismaAdapter
  // writes one row per send keyed by (identifier, token). Match → redirect
  // to the same callback URL Auth.js builds for magic-link clicks.
  // Failed match → record + redirect with error.
  const row = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: rawCode } },
  });
  if (!row || row.expires < new Date()) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await recordFailedGuess(email, ip);
    await db.auditLog
      .create({
        data: {
          action: "signin_code_failed",
          entity: "VerificationToken",
          entityId: email,
          metadata: {
            email,
            reason: row ? "expired" : "no_match",
          },
        },
      })
      .catch(() => undefined);
    redirect(`/signin/verify?error=bad_code`);
  }

  // The code matched. Redirect to the Auth.js callback URL with the
  // same token + email — Auth.js will validate, delete the token,
  // and sign the user in. Identical to the magic-link click path.
  await db.auditLog
    .create({
      data: {
        action: "signin_code_succeeded",
        entity: "VerificationToken",
        entityId: email,
        metadata: { email },
      },
    })
    .catch(() => undefined);
  const callbackUrl = "/";
  const target = `/api/auth/callback/nodemailer?${new URLSearchParams({
    callbackUrl,
    token: rawCode,
    email,
  }).toString()}`;
  redirect(target);
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retry?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const cookieEmail = cookieStore.get(COOKIE_NAME)?.value ?? "";
  const error = sp.error;
  const retry = sp.retry ? Number(sp.retry) : null;

  // v1.53.0 (A2): no cookie → no code-entry path available. Show a
  // friendlier "your session expired" pointer back to /signin rather
  // than rendering the form with an empty email.
  if (!cookieEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
        <div className="w-full max-w-sm bg-surface border border-border-soft rounded-lg shadow-md p-7 text-center">
          <div className="text-4xl mb-3">⌛</div>
          <h1 className="font-display text-2xl font-semibold text-moss-700 mb-2">
            Session expired
          </h1>
          <p className="text-sm text-ink-secondary mb-5">
            Your sign-in session timed out. Request a new code to continue.
          </p>
          <Link
            href="/signin"
            className="inline-block text-sm font-medium bg-moss-500 text-white rounded-sm px-3 py-2 hover:bg-moss-700 transition-colors"
          >
            Back to sign-in
          </Link>
        </div>
      </div>
    );
  }

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
          <p className="text-[11px] text-ink-tertiary mt-2">
            Sending to <strong className="text-ink-secondary">{cookieEmail}</strong>
          </p>
        </div>

        <form action={verifyCode} className="flex flex-col gap-3">
          <label className="text-xs font-medium text-ink-secondary uppercase tracking-wider">
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
