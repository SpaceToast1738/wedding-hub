// v2.1.0: Anthropic client wrapper.
//
// One place that instantiates the SDK, sends messages, records the
// cost + tokens to AiUsage, and emits an audit-log entry so the
// couple can see every AI turn alongside their manual edits. The
// SDK handles retries on 429 / 5xx internally.

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  ANTHROPIC_API_KEY,
  MODEL_TIERS,
  assertConfigured,
  type AiFeature,
  type ModelId,
  type ModelTier,
} from "@/lib/ai/config";
import { computeCostPence } from "@/lib/ai/cost";
import { budgetGuard, rateLimit } from "@/lib/ai/guards";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  assertConfigured();
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY! });
  }
  return cachedClient;
}

export type SendMessageArgs = {
  userId: string;
  feature: AiFeature;
  /** Pick a tier by role instead of pinning a model id — keeps
   *  call sites decoupled from Anthropic's model naming. */
  tier?: ModelTier;
  /** Escape hatch when a specific model is required (e.g. a nightly
   *  Opus timeline generation). Overrides `tier`. */
  model?: ModelId;
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number;
  /** Adaptive thinking. Default: off (thinking omitted). */
  adaptiveThinking?: boolean;
  /** Attach chat context so audit rows can be filtered per-thread. */
  threadId?: string;
  /** Anthropic OutputConfig — the strict JSON-schema flavour of
   *  structured outputs. Kept opaque here; call sites build the
   *  block themselves. */
  outputConfig?: Anthropic.OutputConfig;
};

export type SendMessageResult = {
  content: Anthropic.ContentBlock[];
  stopReason: Anthropic.Message["stop_reason"];
  model: string;
  usage: Anthropic.Message["usage"];
  costPence: number;
};

/** Send one non-streaming Messages API request. Reserves the budget
 *  guard + rate limit *before* the call so a burst can't slip past
 *  the cap. */
export async function sendMessage(args: SendMessageArgs): Promise<SendMessageResult> {
  await Promise.all([budgetGuard(), rateLimit(args.userId, args.feature)]);

  const client = getClient();
  const model = args.model ?? MODEL_TIERS[args.tier ?? "balanced"];

  const request: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: args.maxTokens ?? 8192,
    system: args.system,
    messages: args.messages,
  };
  if (args.tools?.length) request.tools = args.tools;
  if (args.outputConfig) request.output_config = args.outputConfig;
  // Adaptive thinking is the only supported "on" mode on Opus 4.7+
  // and Fable 5; `budget_tokens` returns a 400 on those models.
  // Adaptive lets Claude decide when to think — off entirely when
  // the caller doesn't ask, on when they do.
  if (args.adaptiveThinking) request.thinking = { type: "adaptive" };

  const response = await client.messages.create(request);
  const costPence = computeCostPence(model as ModelId, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? undefined,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? undefined,
  });

  // Fire-and-forget accounting — never block the caller on write
  // failure, but log it so we can see if the ledger drifts.
  void Promise.all([
    db.aiUsage.create({
      data: {
        userId: args.userId,
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costPence,
        feature: args.feature,
      },
    }),
    logAudit({
      userId: args.userId,
      action: "ai.call",
      entity: "AiUsage",
      metadata: {
        feature: args.feature,
        model,
        costPence,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        threadId: args.threadId ?? null,
      },
    }),
  ]).catch((err) => {
    console.error("ai accounting write failed", err);
  });

  return {
    content: response.content,
    stopReason: response.stop_reason,
    model: response.model,
    usage: response.usage,
    costPence,
  };
}
