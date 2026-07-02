// v2.1.0 phase 1: streaming chat loop.
//
// runChatTurn() drives one user message end-to-end: persist it, call
// Anthropic with streaming, forward text deltas as they arrive,
// resolve tool_use blocks in a manual agentic loop, persist the
// assistant turn, and yield structured events an SSE endpoint can
// forward verbatim to the browser.
//
// The generator's caller (see src/app/api/ai/chat/route.ts) is
// responsible for translating events → SSE bytes.

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/actions";
import { canEdit, canView } from "@/lib/permissions";
import {
  ANTHROPIC_API_KEY,
  MODEL_TIERS,
  assertConfigured,
  AI_FEATURES,
} from "@/lib/ai/config";
import { computeCostPence } from "@/lib/ai/cost";
import {
  budgetGuard,
  rateLimit,
  BudgetExceeded,
  RateLimited,
} from "@/lib/ai/guards";
import { buildPlannerSystem } from "@/lib/ai/prompts/system-planner";
import {
  isProposeTool,
  progressLabelFor,
  runTool,
  toolDefinitions,
} from "@/lib/ai/tools/registry";

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  assertConfigured();
  if (!cachedClient) cachedClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY! });
  return cachedClient;
}

export type ChatEvent =
  | { type: "thread"; threadId: string }
  | { type: "text"; text: string }
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_end"; id: string; ok: boolean }
  | {
      type: "proposal_created";
      proposalId: string;
      kind: string;
      title: string;
    }
  | { type: "message_end"; costPence: number; model: string }
  | { type: "done"; totalCostPence: number }
  | { type: "error"; error: string; code?: string };

const MAX_TOOL_ITERATIONS = 6;
const CHAT_HISTORY_LIMIT = 40;

/** Persist and stream one turn. Async generator so the API route can
 *  `for await` it and pipe events straight to the SSE stream. */
export async function* runChatTurn(args: {
  user: SessionUser;
  threadId: string | null;
  text: string;
}): AsyncGenerator<ChatEvent, void, void> {
  const { user, text } = args;

  if (!(await canView(user, "ai_chat"))) {
    yield { type: "error", error: "You don't have access to the AI planner." };
    return;
  }

  try {
    await Promise.all([
      budgetGuard(),
      rateLimit(user.id, AI_FEATURES.chat),
    ]);
  } catch (err) {
    if (err instanceof BudgetExceeded) {
      yield { type: "error", error: err.message, code: err.code };
      return;
    }
    if (err instanceof RateLimited) {
      yield { type: "error", error: err.message, code: err.code };
      return;
    }
    throw err;
  }

  // ─── thread ──────────────────────────────────────────────────────
  let threadId = args.threadId;
  if (threadId) {
    const existing = await db.aiThread.findUnique({
      where: { id: threadId },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== user.id) {
      yield { type: "error", error: "Thread not found." };
      return;
    }
  } else {
    const thread = await db.aiThread.create({
      data: {
        userId: user.id,
        title: text.slice(0, 80),
      },
    });
    threadId = thread.id;
    yield { type: "thread", threadId };
  }

  // ─── persist the user message ────────────────────────────────────
  await db.aiMessage.create({
    data: { threadId, role: "user", content: text },
  });

  // ─── build the message history for Anthropic ─────────────────────
  const prior = await db.aiMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: CHAT_HISTORY_LIMIT,
    select: { role: true, content: true, toolCalls: true },
  });

  const messages: Anthropic.MessageParam[] = [];
  for (const m of prior) {
    if (m.role === "user") {
      messages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      // Reconstruct assistant blocks from stored toolCalls + text.
      const toolCalls = (m.toolCalls as Anthropic.ContentBlock[] | null) ?? null;
      if (toolCalls && toolCalls.length > 0) {
        messages.push({ role: "assistant", content: toolCalls });
      } else if (m.content) {
        messages.push({ role: "assistant", content: m.content });
      }
    } else if (m.role === "tool") {
      // Stored as JSON payload — the string content is a stringified
      // ToolResultBlockParam[]. Fall back to raw text if parsing fails.
      try {
        const parsed = JSON.parse(m.content) as Anthropic.ToolResultBlockParam[];
        messages.push({ role: "user", content: parsed });
      } catch {
        messages.push({ role: "user", content: m.content });
      }
    }
  }

  const canWrite = await canEdit(user, "ai_write");
  const system = await buildPlannerSystem(user, { canWrite });
  const ctx = { user, canWrite };
  const tools = toolDefinitions({ canWrite });
  const model = MODEL_TIERS.balanced;
  const client = getClient();

  let totalCost = 0;

  // ─── agentic loop ────────────────────────────────────────────────
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    let accumulatedText = "";
    let stream: Awaited<ReturnType<Anthropic["messages"]["stream"]>>;
    try {
      stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system,
        messages,
        tools,
      });
    } catch (err) {
      yield {
        type: "error",
        error: err instanceof Error ? err.message : "Failed to open stream.",
      };
      return;
    }

    try {
      for await (const evt of stream) {
        if (
          evt.type === "content_block_delta" &&
          evt.delta.type === "text_delta"
        ) {
          accumulatedText += evt.delta.text;
          yield { type: "text", text: evt.delta.text };
        }
      }
    } catch (err) {
      yield {
        type: "error",
        error: err instanceof Error ? err.message : "Stream failed mid-response.",
      };
      return;
    }

    const finalMessage = await stream.finalMessage();
    const cost = computeCostPence(model, {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
      cacheReadInputTokens: finalMessage.usage.cache_read_input_tokens ?? undefined,
      cacheCreationInputTokens:
        finalMessage.usage.cache_creation_input_tokens ?? undefined,
    });
    totalCost += cost;
    yield { type: "message_end", costPence: cost, model: finalMessage.model };

    void Promise.all([
      db.aiUsage.create({
        data: {
          userId: user.id,
          model: finalMessage.model,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          costPence: cost,
          feature: AI_FEATURES.chat,
        },
      }),
      logAudit({
        userId: user.id,
        action: "ai.call",
        entity: "AiUsage",
        metadata: {
          feature: AI_FEATURES.chat,
          model: finalMessage.model,
          costPence: cost,
          threadId,
          iteration: iter,
        },
      }),
      db.aiMessage.create({
        data: {
          threadId,
          role: "assistant",
          content: accumulatedText,
          toolCalls: finalMessage.content as unknown as object,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          model: finalMessage.model,
        },
      }),
    ]).catch((err) => console.error("ai chat persist failed", err));

    messages.push({ role: "assistant", content: finalMessage.content });

    if (finalMessage.stop_reason !== "tool_use") {
      yield { type: "done", totalCostPence: totalCost };
      return;
    }

    // ─── resolve tool calls ────────────────────────────────────────
    const content = finalMessage.content as Anthropic.ContentBlock[];
    const toolUses = content.filter(
      (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use",
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const t of toolUses) {
      yield {
        type: "tool_start",
        id: t.id,
        name: t.name,
        label: progressLabelFor(t.name),
      };
      const { result, text: resultText } = await runTool(t.name, t.input, ctx);
      yield { type: "tool_end", id: t.id, ok: result.ok };

      // v2.1.0 phase 2: surface newly-created proposals to the panel
      // so it can render Apply/Dismiss cards inline in the transcript.
      if (result.ok && isProposeTool(t.name)) {
        const data = result.data as
          | { proposalId?: string; kind?: string; title?: string }
          | undefined;
        if (data?.proposalId && data.kind && data.title) {
          yield {
            type: "proposal_created",
            proposalId: data.proposalId,
            kind: data.kind,
            title: data.title,
          };
        }
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: t.id,
        content: resultText,
        is_error: !result.ok,
      });
    }

    // Persist the tool_result batch so the next assistant turn can
    // load it back and stay coherent across the chat history.
    await db.aiMessage.create({
      data: {
        threadId,
        role: "tool",
        content: JSON.stringify(toolResults),
      },
    });

    messages.push({ role: "user", content: toolResults });
  }

  yield {
    type: "error",
    error: `Aborted after ${MAX_TOOL_ITERATIONS} tool iterations — the assistant is looping.`,
  };
}
