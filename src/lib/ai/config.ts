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

/** Environment-provided Anthropic key. Retained as the fallback when
 *  no DB-editable key is set. Kept as a plain constant so tests + code
 *  paths that don't touch the DB still get the expected value. */
export const ANTHROPIC_API_KEY_FROM_ENV: string | undefined =
  process.env.ANTHROPIC_API_KEY;

// v2.1.0 phase 6.1: DB-first key resolution.
//
// Reads WeddingSettings.anthropicApiKey; falls back to the env var
// above; then to undefined. Result is cached for a short window so
// tight bursts (chat + tool loop = 3–6 calls per turn) don't hammer
// the DB. `invalidateApiKeyCache()` is called from the settings save
// action so a rotation takes effect on the very next call.
let cachedKey: string | undefined = undefined;
let cachedKeyLoadedAt = 0;
const KEY_CACHE_MS = 30_000;

async function readKeyFromDb(): Promise<string | undefined> {
  try {
    const { db } = await import("@/lib/db");
    const row = await db.weddingSettings.findUnique({
      where: { id: 1 },
      select: { anthropicApiKey: true },
    });
    const trimmed = row?.anthropicApiKey?.trim();
    return trimmed || undefined;
  } catch {
    // DB down mid-request — fall through to the env fallback rather
    // than error the whole AI surface.
    return undefined;
  }
}

export async function getAnthropicApiKey(): Promise<string | undefined> {
  if (Date.now() - cachedKeyLoadedAt < KEY_CACHE_MS && cachedKeyLoadedAt !== 0) {
    return cachedKey;
  }
  const dbKey = await readKeyFromDb();
  cachedKey = dbKey ?? ANTHROPIC_API_KEY_FROM_ENV;
  cachedKeyLoadedAt = Date.now();
  return cachedKey;
}

/** Force the next `getAnthropicApiKey()` call to hit the DB again.
 *  Called from the Settings save action so a rotation lands
 *  immediately for every process (each process caches independently,
 *  but the 30-second TTL bounds the drift). */
export function invalidateApiKeyCache(): void {
  cachedKeyLoadedAt = 0;
  cachedKey = undefined;
}

/** Describe the current key without leaking its full value. Used by
 *  the Settings panel to show "source: settings", "source: env" or
 *  "no key configured", plus a last-4 mask. */
export async function describeApiKey(): Promise<{
  hasKey: boolean;
  source: "settings" | "env" | "none";
  mask: string | null;
}> {
  const dbKey = await readKeyFromDb();
  if (dbKey) {
    return { hasKey: true, source: "settings", mask: maskKey(dbKey) };
  }
  if (ANTHROPIC_API_KEY_FROM_ENV) {
    return {
      hasKey: true,
      source: "env",
      mask: maskKey(ANTHROPIC_API_KEY_FROM_ENV),
    };
  }
  return { hasKey: false, source: "none", mask: null };
}

function maskKey(key: string): string {
  // `sk-ant-…xxxx` — show the prefix + last 4 chars so the reviewer
  // can eyeball which key is set without exposing the rest.
  if (key.length <= 12) return "sk-ant-…";
  return `sk-ant-…${key.slice(-4)}`;
}

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
  gapAnalysis: "gap-analysis",
  breakdownTask: "breakdown-task",
  generateTimeline: "generate-timeline",
  parseGuestList: "parse-guest-list",
  draftGuestMessage: "draft-guest-message",
  reviewWedding: "review-wedding",
} as const;

export type AiFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];

/** Async so it can consult the DB-first key resolver. Throws
 *  AiDisabledError before any outbound call when the surface is off
 *  or unconfigured. */
export async function assertConfigured(): Promise<string> {
  if (!AI_ENABLED) {
    throw new AiDisabledError("AI features are disabled (AI_ENABLED=false).");
  }
  const key = await getAnthropicApiKey();
  if (!key) {
    throw new AiDisabledError(
      "No Anthropic API key configured — set one in Settings → AI planner, or the ANTHROPIC_API_KEY env var.",
    );
  }
  return key;
}

export class AiDisabledError extends Error {
  readonly code = "AI_DISABLED";
  constructor(message: string) {
    super(message);
    this.name = "AiDisabledError";
  }
}
