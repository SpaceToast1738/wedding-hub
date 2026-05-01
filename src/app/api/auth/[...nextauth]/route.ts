import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/auth";
import { checkGuessLimit, recordFailedGuess } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// v1.53.0 (A4): wrap GET so that direct hits to
// /api/auth/callback/nodemailer with ?token=...&email=... go through
// the same per-email guess rate-limit as the verify page form. Pre-fix
// the verify page's bucket only protected the form submit; an attacker
// could hammer the callback URL directly to brute-force the 6-digit
// code without ever touching /signin/verify.
//
// Strategy:
//   1. Pre-check (read-only) `checkGuessLimit(email)`. If blocked,
//      redirect to /signin/verify with the standard rate_limited
//      error — same UX as a blocked form submit.
//   2. Call Auth.js's handler. If it redirects with an error (token
//      mismatch / expired), record a failed guess so the bucket
//      decrements. Successful sign-in consumes nothing — same
//      semantics as the verify page (failures count, successes don't).
//
// Other Auth.js routes (sign-in initiation, session, etc.) pass
// through unchanged.

const CALLBACK_PATH = "/api/auth/callback/nodemailer";

async function rateLimitedGet(req: NextRequest) {
  const url = new URL(req.url);
  if (url.pathname !== CALLBACK_PATH) {
    return handlers.GET(req);
  }
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");
  if (!token || !email) {
    // Auth.js callback shape requires both — let it return its own
    // 400 / redirect rather than us second-guessing.
    return handlers.GET(req);
  }

  const decision = await checkGuessLimit(email);
  if (!decision.ok) {
    // Audit the rate-limited attempt so the security review can see
    // brute-force pressure on the callback path.
    await db.auditLog
      .create({
        data: {
          action: "signin_code_rate_limited",
          entity: "VerificationToken",
          metadata: {
            email,
            retryAfterSec: decision.retryAfterSec,
            via: "callback",
          },
        },
      })
      .catch(() => undefined);
    const verifyUrl = new URL("/signin/verify", url.origin);
    verifyUrl.searchParams.set("error", "rate_limited");
    verifyUrl.searchParams.set("retry", String(decision.retryAfterSec));
    return NextResponse.redirect(verifyUrl);
  }

  const response = await handlers.GET(req);

  // Detect failed token validation. Auth.js redirects to its error
  // page (configured in authConfig.pages.error → /signin/error) on
  // failure, OR appends ?error=... to a callback URL. Either signal
  // counts as a failed guess for rate-limit purposes.
  const status = response.status;
  if (status >= 300 && status < 400) {
    const location = response.headers.get("location") ?? "";
    const failed =
      location.includes("/signin/error") ||
      /[?&]error=/.test(location);
    if (failed) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      await recordFailedGuess(email, ip);
      await db.auditLog
        .create({
          data: {
            action: "signin_code_failed",
            entity: "VerificationToken",
            entityId: email,
            metadata: { email, reason: "callback_rejection", via: "callback" },
          },
        })
        .catch(() => undefined);
    }
  }

  return response;
}

export const GET = rateLimitedGet;
export const POST = handlers.POST;
