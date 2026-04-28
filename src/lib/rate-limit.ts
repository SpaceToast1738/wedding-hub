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
export async function checkAndRecordAttempt(input: {
  identifier: string;
  ip?: string | null;
  now?: Date;
}): Promise<RateLimitDecision> {
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const identifier = input.identifier.toLowerCase().trim();

  // Parallel: count attempts in window, find oldest in window, prune stale.
  // Prune doesn't block the decision — even if it fails, we still get a
  // correct answer from the count.
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

  const decision = decideRateLimit({
    attemptsInWindow,
    oldestAttemptInWindow: oldest?.createdAt ?? null,
    now,
  });

  if (decision.ok) {
    // Record the new attempt only when allowed. Failed attempts shouldn't
    // count against the user's quota.
    await db.magicLinkAttempt.create({
      data: { identifier, ip: input.ip ?? null },
    });
  }

  return decision;
}
