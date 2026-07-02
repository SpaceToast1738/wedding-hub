// v2.1.0: AI rate-limit + budget guard.
//
// Both are soft caps enforced in server actions before the outbound
// Anthropic call. They can't be bypassed by the UI (which is a
// client) but obviously nothing stops a determined operator with DB
// access from resetting them — this is a friendly-limit layer, not
// security.

import { db } from "@/lib/db";
import { DEFAULT_MONTHLY_CAP_PENCE } from "@/lib/ai/config";
import type { AiFeature } from "@/lib/ai/config";
import { getWeddingSettings } from "@/lib/wedding-settings";

export class BudgetExceeded extends Error {
  readonly code = "AI_BUDGET_EXCEEDED";
  constructor(readonly spentPence: number, readonly capPence: number) {
    super(
      `AI monthly budget exceeded: £${(spentPence / 100).toFixed(2)} spent / £${(capPence / 100).toFixed(2)} cap.`,
    );
    this.name = "BudgetExceeded";
  }
}

export class RateLimited extends Error {
  readonly code = "AI_RATE_LIMITED";
  constructor(readonly feature: AiFeature, readonly windowSeconds: number) {
    super(`Rate limit hit for ${feature}: try again in a minute.`);
    this.name = "RateLimited";
  }
}

/** Sum this calendar-month's spending across all users. Shared pot —
 *  the wedding is a joint expense. */
export async function monthlyUsagePence(): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const rows = await db.aiUsage.aggregate({
    where: { createdAt: { gte: startOfMonth } },
    _sum: { costPence: true },
  });
  return rows._sum.costPence ?? 0;
}

/** Read the current cap: WeddingSettings row wins, then env, then
 *  the compile-time default. */
export async function currentCapPence(): Promise<number> {
  try {
    const settings = await db.weddingSettings.findUnique({
      where: { id: 1 },
      select: { aiMonthlyCapPence: true },
    });
    if (settings?.aiMonthlyCapPence != null) return settings.aiMonthlyCapPence;
  } catch {
    // Fall through to env default on any DB hiccup — better to keep
    // AI working than crash the whole surface.
  }
  return DEFAULT_MONTHLY_CAP_PENCE;
}

/** Throw BudgetExceeded if the shared pot is empty. Called before
 *  every outbound Anthropic request. */
export async function budgetGuard(): Promise<void> {
  const [spent, cap] = await Promise.all([monthlyUsagePence(), currentCapPence()]);
  if (spent >= cap) throw new BudgetExceeded(spent, cap);
}

// ─── Rate limiting ────────────────────────────────────────────────────
//
// Per-user, per-feature rolling window using AiUsage row counts as
// the accounting surface. Not exact under high concurrency (two
// requests racing to write) but the app has 5 users total — good
// enough. If we ever add a global limiter, revisit.

// Keys are the AiFeature *values* (kebab-case), not the AI_FEATURES
// map keys — the type is `Partial<Record<AiFeature, ...>>`.
const DEFAULT_LIMITS: Partial<Record<AiFeature, { max: number; windowSec: number }>> = {
  chat: { max: 20, windowSec: 5 * 60 },
  ping: { max: 5, windowSec: 60 },
  "summarize-card": { max: 20, windowSec: 60 },
  "suggest-tasks": { max: 5, windowSec: 60 * 60 },
  "suggest-due-dates": { max: 5, windowSec: 60 * 60 },
  "generate-timeline": { max: 3, windowSec: 60 * 60 },
  "parse-guest-list": { max: 10, windowSec: 60 * 60 },
  "draft-guest-message": { max: 20, windowSec: 60 * 60 },
  "review-wedding": { max: 3, windowSec: 60 * 60 },
};

export async function rateLimit(userId: string, feature: AiFeature): Promise<void> {
  const limit = DEFAULT_LIMITS[feature];
  if (!limit) return;

  const since = new Date(Date.now() - limit.windowSec * 1000);
  const count = await db.aiUsage.count({
    where: { userId, feature, createdAt: { gte: since } },
  });
  if (count >= limit.max) throw new RateLimited(feature, limit.windowSec);
}

/** Handy `Promise<true>`-style helper for surfaces that want to
 *  render a cap warning without throwing. */
export async function readCapState(): Promise<{
  spentPence: number;
  capPence: number;
  remainingPence: number;
  weddingWeeksLeft: number;
}> {
  const [spent, cap, settings] = await Promise.all([
    monthlyUsagePence(),
    currentCapPence(),
    getWeddingSettings(),
  ]);
  const weeksLeft = Math.max(
    0,
    Math.floor(
      (settings.weddingDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000),
    ),
  );
  return {
    spentPence: spent,
    capPence: cap,
    remainingPence: Math.max(0, cap - spent),
    weddingWeeksLeft: weeksLeft,
  };
}
