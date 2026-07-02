// v2.1.0: AI cost accounting.
//
// Anthropic bills in USD per million tokens. We track internal
// spending in £-pence so the budget cap in WeddingSettings stays a
// single integer the user can type. The FX conversion is coarse on
// purpose — a wedding-hub monthly cap doesn't need to trade forex.
//
// If the £/$ rate shifts materially, edit USD_CENT_TO_PENCE and
// backfilling old rows isn't required (the cap check reads the
// pre-computed costPence at write time, which is what actually
// mattered).

import type { ModelId } from "@/lib/ai/config";

/** Rough 2026 sterling. £1 ≈ $1.27 → 100 pence ≈ 127 US-cents →
 *  1 US-cent ≈ 0.79 pence. */
const USD_CENT_TO_PENCE = 0.79;

/** Prices in **US cents per million tokens**, straight from the
 *  Anthropic models table. Update this table when Anthropic ships
 *  a new price; do NOT recompute historical AiUsage rows — those
 *  represent what we were charged at the time. */
const PRICING_USD_CENTS_PER_MTOK: Record<ModelId, {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}> = {
  "claude-haiku-4-5":  { input: 100,  output: 500,  cacheRead: 10,  cacheWrite: 125 },
  "claude-sonnet-4-6": { input: 300,  output: 1500, cacheRead: 30,  cacheWrite: 375 },
  "claude-opus-4-8":   { input: 500,  output: 2500, cacheRead: 50,  cacheWrite: 625 },
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
};

/** Compute the cost of one API call, in whole pence, rounded UP so
 *  aggregate spend is never under-reported to the budget guard. */
export function computeCostPence(model: ModelId, usage: Usage): number {
  const price = PRICING_USD_CENTS_PER_MTOK[model];
  if (!price) {
    // Unknown model — bill at the highest-tier price as a safe fallback.
    // Never silently return zero (would break the budget guard).
    return computeCostPence("claude-opus-4-8", usage);
  }

  const cacheRead = usage.cacheReadInputTokens ?? 0;
  const cacheWrite = usage.cacheCreationInputTokens ?? 0;
  const uncachedInput = Math.max(0, usage.inputTokens - cacheRead - cacheWrite);

  const usdCents =
    (uncachedInput * price.input +
      cacheRead * price.cacheRead +
      cacheWrite * price.cacheWrite +
      usage.outputTokens * price.output) /
    1_000_000;

  return Math.ceil(usdCents * USD_CENT_TO_PENCE);
}
