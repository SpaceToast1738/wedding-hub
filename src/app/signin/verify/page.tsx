import Link from "next/link";
import { cookies } from "next/headers";
import { VERIFY_LIMIT_MAX_PER_EMAIL } from "@/lib/rate-limit";
import { VerifyForm } from "./VerifyForm";

// v1.50.0: code-entry sign-in. Replaces the v1.20.0 "check your inbox"
// placeholder. The flow:
//   1. /signin sets a `signin-email` cookie + sends the email (which now
//      contains both a magic-link button and a 6-digit code).
//   2. User lands here; the cookie carries the email server-side. They
//      type the 6-digit code from the email.
//   3. The verifyCode server action (./actions.ts) validates the code
//      against the VerificationToken row Auth.js wrote, then RETURNS the
//      callback URL. VerifyForm navigates to it as a real top-level GET so
//      the Auth.js session cookie sticks — see ./actions.ts for the full
//      v2.8.5 write-up.
//
// v2.8.5: the validation + client-navigation split lives in ./actions.ts
// and ./VerifyForm.tsx. This page is now just the server shell: it reads
// the signin-email cookie, shows the expired-session screen when it's
// missing, and otherwise renders VerifyForm.

const COOKIE_NAME = "signin-email";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retry?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const cookieEmail = cookieStore.get(COOKIE_NAME)?.value ?? "";
  const retry = sp.retry ? Number(sp.retry) : null;

  // v1.53.0 (A2): no cookie → no code-entry path available. Show a
  // friendlier "your session expired" pointer back to /signin rather than
  // rendering the form with an empty email.
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
            className="inline-block text-sm font-medium bg-moss-500 text-on-moss rounded-sm px-3 py-2 hover:bg-moss-700 transition-colors"
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

        <VerifyForm
          guessLimit={VERIFY_LIMIT_MAX_PER_EMAIL}
          initialError={sp.error}
          initialRetry={retry}
        />

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
