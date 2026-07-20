"use client";

// v2.8.5: client half of the code-entry flow. See ./actions.ts for the
// full "why" — the short version is that the session cookie must be minted
// on a REAL top-level navigation to /api/auth/callback/nodemailer, not via
// a Server-Action redirect() (which makes Next swallow the Set-Cookie).
//
// So verifyCode returns { status: "ok", url } and this component does a
// single guarded window.location.replace(url) — a genuine browser GET that
// commits the cookie and follows the callback's 302 to "/" logged-in,
// exactly like clicking the magic link.

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { verifyCode, type VerifyState } from "./actions";
import { SubmitButton } from "../SubmitButton";

const INITIAL: VerifyState = { status: "idle" };

export function VerifyForm({
  guessLimit,
  initialError,
  initialRetry,
}: {
  guessLimit: number;
  // Callback-originated errors can land here via the URL (e.g. the
  // /api/auth/callback wrapper redirects to /signin/verify?error=rate_limited
  // when a magic-link callback is rate-limited). Shown until the user
  // submits, after which action state takes over.
  initialError?: string;
  initialRetry?: number | null;
}) {
  const [state, action] = useActionState(verifyCode, INITIAL);
  const fired = useRef(false);

  useEffect(() => {
    if (state.status === "ok" && !fired.current) {
      fired.current = true;
      // Real top-level navigation → the browser commits the
      // __Secure-authjs.session-token that the callback route emits, then
      // follows its 302 to "/". replace() keeps the single-use token URL
      // out of history and prevents a back-button re-hit of the callback.
      window.location.replace(state.url);
    }
  }, [state]);

  if (state.status === "ok") {
    return (
      <p className="text-sm text-ink-secondary text-center py-6" role="status">
        Signing you in…
      </p>
    );
  }

  // Prefer live action-state errors; fall back to a URL-supplied error on
  // first render (before any submit).
  const error =
    state.status === "error"
      ? state.error
      : initialError ?? null;
  const retry =
    state.status === "error"
      ? state.retry ?? null
      : initialRetry ?? null;

  return (
    <>
      <form action={action} className="flex flex-col gap-3">
        {/* v2.5.0: htmlFor/id pairing — kept as plain elements (not the
            Input component) since this field's large/mono/tracked styling
            doesn't fit Input's default sizing. */}
        <label
          htmlFor="code"
          className="text-xs font-medium text-ink-secondary uppercase tracking-wider"
        >
          6-digit code
        </label>
        <input
          id="code"
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

        {/* v2.5.0 (design pass #5): pending state so a slow code check
            can't be double-clicked into burning an extra attempt against
            the 5-guess rate limit. */}
        <SubmitButton pendingLabel="Signing in…" className="mt-2">
          Sign in
        </SubmitButton>
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
          . (Limit: {guessLimit} attempts per 15 minutes per email.)
        </p>
      )}
      {error === "expired" && (
        <p className="text-xs text-danger mt-4">
          Your sign-in session timed out.{" "}
          <Link href="/signin" className="text-moss-500 underline">
            Request a new code
          </Link>
          .
        </p>
      )}
    </>
  );
}
