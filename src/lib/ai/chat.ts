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

import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/actions";
import { canEdit, canView } from "@/lib/permissions";
import {
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

// v2.1.0 phase 6.1: cached client keyed by api key string; rebuilds
// when the DB-editable key rotates. Duplicated with src/lib/ai/client
// on purpose — the streaming chat loop and the one-shot sendMessage
// path each own their client to avoid coupling instantiation timing.
let cachedClient: { client: Anthropic; key: string } | null = null;
async function getClient(): Promise<Anthropic> {
  const key = await assertConfigured();
  if (!cachedClient || cachedClient.key !== key) {
    cachedClient = { client: new Anthropic({ apiKey: key }), key };
  }
  return cachedClient.client;
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
      /** v2.2.0: resolved-names line ("→ Sarah · Flowers"). */
      detail?: string;
      /** v2.2.0: shared per-turn batch id for grouped approval. */
      batchId?: string;
    }
  | { type: "message_end"; costPence: number; model: string }
  | { type: "done"; totalCostPence: number }
  | { type: "error"; error: string; code?: string };

// v2.2.0: 6 → 8. A batch turn legitimately needs read_proposals +
// read_tasks + serialized propose calls + a closing prose turn; the
// prompt nudges parallel tool calls (which land in ONE iteration) but
// Sonnet sometimes serializes anyway. Keep a hard stop against loops.
// v2.4.0: 8 → 12. Book edits are now read_book → read_book_card →
// propose (3 round trips) and breakdown adds read_tasks +
// read_proposals; 12 covers the deeper read-before-write chains while
// still stopping runaway loops.
const MAX_TOOL_ITERATIONS = 12;
const CHAT_HISTORY_LIMIT = 40;
// v2.2.0: 4096 → 8192. A parallel propose batch carries many tool_use
// blocks; max_tokens is a ceiling not a cost, and hitting it
// mid-tool_use silently truncated the turn pre-fix.
const MAX_OUTPUT_TOKENS = 8192;

type BlockLike = { type?: string };

/** v2.2.0 review fix: make the reconstructed history Anthropic-legal.
 *
 *  Two ways stored rows go bad: (a) a max_tokens stop persists an
 *  assistant row with tool_use blocks whose tool_result rows never
 *  got written — replaying that verbatim 400s every subsequent turn
 *  in the thread; (b) the history window can slice a tool_use /
 *  tool_result pair apart at its boundary. This walker:
 *    - strips tool_use blocks from an assistant message unless the
 *      NEXT message resolves every one of them with a tool_result;
 *    - drops orphan tool_result blocks whose tool_use isn't in the
 *      immediately preceding kept assistant message;
 *    - drops leading assistant messages (first message must be user).
 *  Healing happens at read time, so threads wedged by old truncated
 *  turns recover on their next message. */
function sanitizeHistory(
  input: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];

  for (let i = 0; i < input.length; i++) {
    const m = input[i]!;

    if (m.role === "assistant" && Array.isArray(m.content)) {
      const toolUses = m.content.filter(
        (b): b is Anthropic.ToolUseBlock => (b as BlockLike).type === "tool_use",
      );
      if (toolUses.length > 0) {
        const next = input[i + 1];
        const resultIds = new Set<string>();
        if (next && next.role === "user" && Array.isArray(next.content)) {
          for (const b of next.content) {
            if ((b as BlockLike).type === "tool_result") {
              resultIds.add((b as Anthropic.ToolResultBlockParam).tool_use_id);
            }
          }
        }
        const allResolved = toolUses.every((t) => resultIds.has(t.id));
        if (!allResolved) {
          const stripped = (m.content as BlockLike[]).filter(
            (b) => b.type !== "tool_use",
          );
          if (stripped.length > 0) {
            out.push({
              role: "assistant",
              content: stripped as Anthropic.MessageParam["content"],
            });
          }
          continue;
        }
      }
    }

    if (m.role === "user" && Array.isArray(m.content)) {
      const hasToolResult = (m.content as BlockLike[]).some(
        (b) => b.type === "tool_result",
      );
      if (hasToolResult) {
        const prev = out[out.length - 1];
        const prevToolUseIds = new Set<string>();
        if (prev && prev.role === "assistant" && Array.isArray(prev.content)) {
          for (const b of prev.content) {
            if ((b as BlockLike).type === "tool_use") {
              prevToolUseIds.add((b as Anthropic.ToolUseBlock).id);
            }
          }
        }
        const kept = (m.content as BlockLike[]).filter(
          (b) =>
            b.type !== "tool_result" ||
            prevToolUseIds.has((b as Anthropic.ToolResultBlockParam).tool_use_id),
        );
        if (kept.length === 0) continue;
        out.push({
          role: "user",
          content: kept as Anthropic.MessageParam["content"],
        });
        continue;
      }
    }

    out.push(m);
  }

  // First message must be role "user".
  while (out.length > 0 && out[0]!.role !== "user") out.shift();
  return out;
}

/** Persist and stream one turn. Async generator so the API route can
 *  `for await` it and pipe events straight to the SSE stream. */
export async function* runChatTurn(args: {
  user: SessionUser;
  threadId: string | null;
  text: string;
  /** v2.2.0: sanitized pathname the panel was opened on ("/guests/abc").
   *  Injected as a trailing system block; stored as contextRef on new
   *  threads. Null = no page context. */
  pathname?: string | null;
}): AsyncGenerator<ChatEvent, void, void> {
  const { user, text, pathname } = args;

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
        // v2.2.0: where the chat was opened from ("route:/guests/abc").
        contextRef: pathname ? `route:${pathname}` : null,
      },
    });
    threadId = thread.id;
    yield { type: "thread", threadId };
  }

  // ─── persist the user message ────────────────────────────────────
  await db.aiMessage.create({
    data: { threadId, role: "user", content: text },
  });
  // Bump the thread's updatedAt so the History list orders by real
  // activity (message creates don't touch the parent row).
  void db.aiThread
    .update({ where: { id: threadId }, data: { updatedAt: new Date() } })
    .catch(() => {});

  // ─── build the message history for Anthropic ─────────────────────
  // v2.2.0 review fix: take the NEWEST rows. The original asc+take
  // returned the OLDEST 40, so once a thread grew past the cap the
  // just-typed message fell outside the window and the model never
  // saw it. desc+take+reverse = most-recent window in chrono order.
  const priorDesc = await db.aiMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: CHAT_HISTORY_LIMIT,
    select: { role: true, content: true, toolCalls: true },
  });
  const prior = priorDesc.reverse();

  const rawMessages: Anthropic.MessageParam[] = [];
  for (const m of prior) {
    if (m.role === "user") {
      rawMessages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      // Reconstruct assistant blocks from stored toolCalls + text.
      const toolCalls = (m.toolCalls as Anthropic.ContentBlock[] | null) ?? null;
      if (toolCalls && toolCalls.length > 0) {
        rawMessages.push({ role: "assistant", content: toolCalls });
      } else if (m.content) {
        rawMessages.push({ role: "assistant", content: m.content });
      }
    } else if (m.role === "tool") {
      // Stored as JSON payload — the string content is a stringified
      // ToolResultBlockParam[]. Fall back to raw text if parsing fails.
      try {
        const parsed = JSON.parse(m.content) as Anthropic.ToolResultBlockParam[];
        rawMessages.push({ role: "user", content: parsed });
      } catch {
        rawMessages.push({ role: "user", content: m.content });
      }
    }
  }
  const messages = sanitizeHistory(rawMessages);

  const canWrite = await canEdit(user, "ai_write");
  const system = await buildPlannerSystem(user, { canWrite, pathname });
  // v2.2.0: every proposal created during this turn shares one batch
  // id so the review UIs can offer approve-all.
  const batchId = randomUUID();
  // v2.4.0: shared mutable proposal counter — every propose tool
  // increments it via takeProposalSlots so one turn can't flood the
  // review queue past PROPOSAL_TURN_CAP.
  const ctx = { user, canWrite, batchId, proposalsCreated: { count: 0 } };
  const tools = toolDefinitions({ canWrite });
  const model = MODEL_TIERS.balanced;
  const client = await getClient();

  let totalCost = 0;

  // ─── agentic loop ────────────────────────────────────────────────
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    // v2.4.0: re-check the monthly pot every iteration, not just once
    // per turn — at 12 iterations × 8K max output tokens, a single
    // deep turn could otherwise run several calls past an exhausted
    // cap. First iteration is covered by the pre-turn guard; this
    // catches mid-turn exhaustion cheaply (one aggregate query).
    if (iter > 0) {
      try {
        await budgetGuard();
      } catch (err) {
        yield {
          type: "error",
          error:
            err instanceof Error ? err.message : "AI monthly budget exceeded mid-turn.",
          code: "AI_BUDGET_EXCEEDED",
        };
        return;
      }
    }
    let accumulatedText = "";
    let stream: Awaited<ReturnType<Anthropic["messages"]["stream"]>>;
    try {
      stream = client.messages.stream({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
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

    // v2.2.0: a max_tokens stop mid-turn used to fall through the
    // tool_use branch and end silently with truncated output — flag
    // it so the user knows to retry with a narrower ask.
    if (finalMessage.stop_reason === "max_tokens") {
      yield {
        type: "error",
        error:
          "The response hit its length limit and was cut off. Try a narrower request (e.g. fewer items at once).",
      };
      return;
    }

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
      // v2.4.0: batch-producing tools (propose_task_breakdown) return
      // `proposals` (plural) — emit one event per entry so the panel
      // renders its normal batch card instead of nothing.
      if (result.ok && isProposeTool(t.name)) {
        const data = result.data as
          | {
              proposalId?: string;
              kind?: string;
              title?: string;
              detail?: string;
              proposals?: Array<{ proposalId: string; kind: string; title: string }>;
            }
          | undefined;
        if (Array.isArray(data?.proposals)) {
          for (const p of data.proposals) {
            if (!p.proposalId || !p.kind || !p.title) continue;
            yield {
              type: "proposal_created",
              proposalId: p.proposalId,
              kind: p.kind,
              title: p.title,
              batchId,
            };
          }
        } else if (data?.proposalId && data.kind && data.title) {
          yield {
            type: "proposal_created",
            proposalId: data.proposalId,
            kind: data.kind,
            title: data.title,
            detail: data.detail,
            batchId,
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
