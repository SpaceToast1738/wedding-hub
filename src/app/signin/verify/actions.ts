"use server";

import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { checkGuessLimit, recordFailedGuess } from "@/lib/rate-limit";
import { hashVerificationToken } from "@/lib/verification-token";

// v2.8.5: code-entry validation, split out of the page's inline server
// action. It returns a VerifyState instead of redirect()-ing, because the
// FINAL hop — the one that actually mints the session cookie — must be a
// real top-level browser navigation, not a Server-Action redirect().
//
// Why (the v2.8.5 bug): the session cookie (__Secure-authjs.session-token)
// is emitted by the /api/auth/callback/nodemailer Route Handler on its
// 302 → "/". In the Next.js App Router a Route Handler's Set-Cookie is
// committed to the browser ONLY when that handler is reached by a genuine
// top-level document navigation. Reaching it via a Server-Action
// redirect() (the pre-2.8.5 flow) runs the navigation through the client
// router's internal RSC/fetch pipeline, where the downstream handler's
// Set-Cookie is consumed inside the fetch and never replayed onto the
// document. Result: the code was accepted server-side (token consumed,
// emailVerified stamped, signin event fired) yet the browser never kept
// the cookie, so the next request to "/" was cookieless and middleware
// bounced it back to /signin. The magic-link click was unaffected because
// it hits the same callback as a real top-level GET.
//
// The fix: verifyCode RETURNS the callback URL on a successful match; the
// client component (VerifyForm) performs a single window.location.replace
// to it — a real top-level GET that commits the cookie exactly like the
// magic link. That also removes the self-inflicted double callback hit
// (one guarded navigation instead of a router soft-nav that could fall
// back to a second request → the old callback_rejection double-consume).
//
// Every validation / rate-limit / audit step below is preserved verbatim
// from the pre-2.8.5 inline action.

const COOKIE_NAME = "signin-email";

export type VerifyState =
  | { status: "idle" }
  | {
      status: "error";
      error: "expired" | "invalid_code" | "rate_limited" | "bad_code";
      retry?: number;
    }
  | { status: "ok"; url: string };

export async function verifyCode(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  // v1.53.0 (A2): email comes from the httpOnly cookie set by /signin's
  // server action. The form carries no email input. Cookie missing or
  // expired (15-min TTL) → the user has to re-request a code.
  const cookieStore = await cookies();
  const email = (cookieStore.get(COOKIE_NAME)?.value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { status: "error", error: "expired" };
  }

  const rawCode = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (rawCode.length !== 6) {
    return { status: "error", error: "invalid_code" };
  }

  // Rate-limit guesses BEFORE consulting the DB so a burst of failed
  // attempts can't burn the verification token via the lookup overhead.
  // v1.53.0 (A1): read-only check — only failed guesses below record a
  // row. Successful matches consume nothing.
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
    return { status: "error", error: "rate_limited", retry: decision.retryAfterSec };
  }

  // Validate the code against the VerificationToken table. PrismaAdapter
  // writes one row per send keyed by (identifier, HASHED token).
  // v2.8.3: @auth/core >=0.41 stores sha256(code + AUTH_SECRET), NOT the
  // plaintext 6 digits — so hash the entered code the same way before the
  // lookup, or every entry is a false no_match. The callback URL returned
  // below still hands Auth.js the PLAINTEXT code; its callback re-hashes
  // it identically.
  const hashedCode = hashVerificationToken(rawCode, process.env.AUTH_SECRET ?? "");
  const row = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: hashedCode } },
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
    return { status: "error", error: "bad_code" };
  }

  // The code matched. Hand the PLAINTEXT token + email to the Auth.js
  // callback URL — Auth.js re-hashes, deletes the token, and signs the
  // user in, identical to the magic-link click path. The client performs
  // this navigation as a real top-level GET so the callback's Set-Cookie
  // sticks (see the file header).
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
  const url = `/api/auth/callback/nodemailer?${new URLSearchParams({
    callbackUrl: "/",
    token: rawCode,
    email,
  }).toString()}`;
  return { status: "ok", url };
}
