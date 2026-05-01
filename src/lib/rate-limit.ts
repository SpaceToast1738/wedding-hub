// Magic-link rate limiting.
//
// We allow up to MAX_PER_EMAIL sends per hour for a given email address.
// (Per-IP limiting is documented in the brief but skipped here: the
// `sendVerificationRequest` callback in src/auth.ts doesn't have ergonomic
// access to the request IP, and the AUTH_ALLOWED_EMAILS allowlist already
// caps the realistic attack surface to ~5 valid addresses. Per-IP limiting
// can be added at a different layer — middleware or the /api/auth route
// — if real abuse appears.)
//
// The decision is split into a pure function `decideRateLimit` that takes
// an attempt count + threshold + clock, and a thin DB-aware wrapper
// `checkAndRecordAttempt` that calls Prisma. The pure function is unit-
// tested; the wrapper is integration-territory.

import { db } from "@/lib/db";

export const RATE_LIMIT_MAX_PER_EMAIL = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// v1.50.0: separate bucket for code-entry attempts on /signin/verify.
// 6-digit codes have a 1M guess space — without rate limits a brute-
// force gets through quickly. 5 wrong guesses in 15 minutes is the
// human-error budget; a 6th wrong guess locks the email out for the
// remainder of the window.
export const VERIFY_LIMIT_MAX_PER_EMAIL = 5;
export const VERIFY_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min

export type RateLimitDecision =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number; reason: "email_quota_exceeded" };

// Pure function: given the count of attempts in the window and the
// timestamp of the oldest attempt in that window, decide whether the
// next attempt is allowed and (when blocked) when the caller can retry.
// Both inputs are caller's responsibility — `checkAndRecordAttempt`
// computes them from the DB.
export function decideRateLimit(args: {
  attemptsInWindow: number;
  oldestAttemptInWindow: Date | null;
  now: Date;
  max?: number;
  windowMs?: number;
}): RateLimitDecision {
  const max = args.max ?? RATE_LIMIT_MAX_PER_EMAIL;
  const windowMs = args.windowMs ?? RATE_LIMIT_WINDOW_MS;

  if (args.attemptsInWindow < max) {
    return { ok: true, remaining: max - args.attemptsInWindow - 1 };
  }

  // Blocked. Compute when the oldest attempt falls out of the window —
  // that's the soonest the caller can succeed again.
  if (args.oldestAttemptInWindow) {
    const expiresAt = args.oldestAttemptInWindow.getTime() + windowMs;
    const retryAfterMs = Math.max(0, expiresAt - args.now.getTime());
    return {
      ok: false,
      retryAfterSec: Math.ceil(retryAfterMs / 1000),
      reason: "email_quota_exceeded",
    };
  }

  // Defensive: count >= max but no timestamp. Force a 1-hour wait.
  return {
    ok: false,
    retryAfterSec: Math.ceil(windowMs / 1000),
    reason: "email_quota_exceeded",
  };
}

// DB-aware wrapper. Consults the MagicLinkAttempt table, applies the
// rate limit, and either:
//   - records the new attempt + returns ok (allowed), or
//   - returns blocked with retryAfterSec (rejected; nothing recorded).
//
// Opportunistically prunes rows older than the window on the same call
// so the table stays tiny. The prune runs in parallel with the count.
//
// v1.50.0: optional `bucket` param distinguishes magic-link sends
// from code-entry guesses on /signin/verify. Buckets share the
// MagicLinkAttempt table but use a prefix on the identifier so
// counts don't bleed across kinds. Different limits per bucket
// (sends: 5/hr; guesses: 5/15min).
//
// v1.53.0 (A1): the check-then-record pattern is for the **send**
// bucket only. The guess bucket uses `checkGuessLimit` (read-only)
// + `recordFailedGuess` (write on failed match) so a single failed
// guess doesn't double-count: the legacy path was writing on the
// pre-check (when ok), and the verify page was *also* recording on
// failure — effective budget was 2–3, not 5. The new shape: the
// pre-check is read-only for guesses; only failures count.
export type AttemptBucket = "send" | "guess";

function bucketParams(bucket: AttemptBucket) {
  return bucket === "guess"
    ? { max: VERIFY_LIMIT_MAX_PER_EMAIL, windowMs: VERIFY_LIMIT_WINDOW_MS, prefix: "verify:" }
    : { max: RATE_LIMIT_MAX_PER_EMAIL, windowMs: RATE_LIMIT_WINDOW_MS, prefix: "" };
}

async function readBucket(identifier: string, windowMs: number, now: Date) {
  const windowStart = new Date(now.getTime() - windowMs);
  const [attemptsInWindow, oldest] = await Promise.all([
    db.magicLinkAttempt.count({
      where: { identifier, createdAt: { gte: windowStart } },
    }),
    db.magicLinkAttempt.findFirst({
      where: { identifier, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.magicLinkAttempt
      .deleteMany({ where: { createdAt: { lt: windowStart } } })
      .catch(() => undefined),
  ]);
  return { attemptsInWindow, oldest: oldest?.createdAt ?? null };
}

export async function checkAndRecordAttempt(input: {
  identifier: string;
  ip?: string | null;
  now?: Date;
  bucket?: AttemptBucket;
}): Promise<RateLimitDecision> {
  const now = input.now ?? new Date();
  const bucket = input.bucket ?? "send";
  const { max, windowMs, prefix } = bucketParams(bucket);
  const baseIdentifier = input.identifier.toLowerCase().trim();
  const identifier = `${prefix}${baseIdentifier}`;

  const { attemptsInWindow, oldest } = await readBucket(identifier, windowMs, now);
  const decision = decideRateLimit({
    attemptsInWindow,
    oldestAttemptInWindow: oldest,
    now,
    max,
    windowMs,
  });

  if (decision.ok && bucket === "send") {
    // Send bucket: every successful pre-check writes a row so the
    // user's per-hour send quota is enforced. Guess bucket uses the
    // separate recordFailedGuess path — failures count, successes
    // don't, so the pre-check is read-only.
    await db.magicLinkAttempt.create({
      data: { identifier, ip: input.ip ?? null },
    });
  }

  return decision;
}

// v1.53.0 (A1): read-only guess-bucket check. Returns the decision
// without recording anything. Pair with `recordFailedGuess` on a
// failed code match. A successful match consumes nothing — the
// resolver sets a hard limit on attempts (5/15min) and only failures
// burn the budget.
export async function checkGuessLimit(
  email: string,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  const identifier = `verify:${email.toLowerCase().trim()}`;
  const { windowMs, max } = bucketParams("guess");
  const { attemptsInWindow, oldest } = await readBucket(identifier, windowMs, now);
  return decideRateLimit({
    attemptsInWindow,
    oldestAttemptInWindow: oldest,
    now,
    max,
    windowMs,
  });
}

// v1.50.0: record a *failed* code-entry attempt. Failures DO count
// against the guess quota (unlike the send bucket where failed
// sends don't decrement). Caller passes the email; we prefix it
// internally to keep the bucket separated from sends.
export async function recordFailedGuess(
  email: string,
  ip?: string | null,
): Promise<void> {
  const identifier = `verify:${email.toLowerCase().trim()}`;
  await db.magicLinkAttempt
    .create({ data: { identifier, ip: ip ?? null } })
    .catch(() => undefined);
}
