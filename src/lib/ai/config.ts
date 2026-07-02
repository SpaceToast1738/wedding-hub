// v2.1.0: AI planner config.
//
// One place for the API key, model tiers, feature flags, and hard
// defaults for the monthly cap. Read from process.env inline — no
// typed config module for the app as a whole (see .env.production.example
// + CLAUDE.md).

/** The three tiers we route features through — see the ROADMAP entry
 *  for which feature uses which tier.
 *
 *  Anthropic's own guidance is to default to Opus 4.8 unless there's
 *  a reason not to. In this app the reason is the user's £10–30/month
 *  budget cap — a wedding-planner chat run entirely on Opus would hit
 *  the cap in a fraction of the intended runway. So most features run
 *  on Sonnet 4.6 (still very capable, ~5× cheaper) with Opus reserved
 *  for the deep "generate my whole plan" one-shots.
 *
 *  Model IDs are the bare aliases from the Anthropic models table —
 *  never append a dated suffix.
 */
export const MODEL_TIERS = {
  fast: "claude-haiku-4-5",
  balanced: "claude-sonnet-4-6",
  deep: "claude-opus-4-8",
} as const;

export type ModelTier = keyof typeof MODEL_TIERS;
export type ModelId = (typeof MODEL_TIERS)[ModelTier];

/** Kill-switch. When false the side panel doesn't mount, /api/ai/*
 *  returns 503, and any lingering server actions throw before making
 *  a network call. Cheap way to pull the emergency brake. */
export const AI_ENABLED: boolean = process.env.AI_ENABLED !== "false";

/** Anthropic API key. Absence isn't fatal at import time (so tests +
 *  local dev without a key still boot); the client's `assertConfigured`
 *  check throws before the first outbound call. */
export const ANTHROPIC_API_KEY: string | undefined = process.env.ANTHROPIC_API_KEY;

/** Fallback monthly cap when WeddingSettings.aiMonthlyCapPence is null.
 *  £30 = 3000 pence. Kept below any real Anthropic invoice we'd expect. */
export const DEFAULT_MONTHLY_CAP_PENCE = Number(
  process.env.AI_MONTHLY_CAP_PENCE ?? 3000,
);

/** Feature labels used for AiUsage.feature and audit.metadata. Keep in
 *  sync with the review dashboard's filter chips. */
export const AI_FEATURES = {
  chat: "chat",
  ping: "ping",
  summarizeCard: "summarize-card",
  suggestTasks: "suggest-tasks",
  suggestDueDates: "suggest-due-dates",
  generateTimeline: "generate-timeline",
  parseGuestList: "parse-guest-list",
  draftGuestMessage: "draft-guest-message",
  reviewWedding: "review-wedding",
} as const;

export type AiFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];

export function assertConfigured(): void {
  if (!AI_ENABLED) {
    throw new AiDisabledError("AI features are disabled (AI_ENABLED=false).");
  }
  if (!ANTHROPIC_API_KEY) {
    throw new AiDisabledError(
      "ANTHROPIC_API_KEY is not set — AI features can't run.",
    );
  }
}

export class AiDisabledError extends Error {
  readonly code = "AI_DISABLED";
  constructor(message: string) {
    super(message);
    this.name = "AiDisabledError";
  }
}
