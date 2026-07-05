import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { sanitizeHistory } from "@/lib/ai/sanitize-history";

// v2.4.2: regression suite for the chat-history sanitizer. The
// production 400 on 2026-07-05 ("unexpected tool_use_id found in
// tool_result blocks ... messages.0") came from the head rule: the
// 40-row window started ON an assistant tool_use message, the pairing
// checks kept the pair, then "first message must be user" shifted the
// assistant off and left its tool_result as messages[0].

type Msg = Anthropic.MessageParam;

// Cast: the SDK's ToolUseBlock carries response-only metadata fields
// (e.g. `caller`) that never round-trip through our stored history —
// the sanitizer only reads type/id.
const toolUse = (id: string): Anthropic.ToolUseBlock =>
  ({
    type: "tool_use",
    id,
    name: "read_tasks",
    input: {},
  }) as Anthropic.ToolUseBlock;
const toolResult = (id: string): Anthropic.ToolResultBlockParam => ({
  type: "tool_result",
  tool_use_id: id,
  content: "{}",
});
const textBlock = (text: string) => ({ type: "text" as const, text });

function firstMessageIsLegal(out: Msg[]): void {
  if (out.length === 0) return;
  const first = out[0]!;
  expect(first.role).toBe("user");
  if (Array.isArray(first.content)) {
    for (const b of first.content) {
      expect((b as { type?: string }).type).not.toBe("tool_result");
    }
  }
}

/** Every tool_result must be resolved by a tool_use in the message
 *  immediately before it — the API-side invariant the sanitizer
 *  exists to guarantee. */
function allToolResultsResolved(out: Msg[]): void {
  for (let i = 0; i < out.length; i++) {
    const m = out[i]!;
    if (m.role !== "user" || !Array.isArray(m.content)) continue;
    const results = m.content.filter(
      (b): b is Anthropic.ToolResultBlockParam =>
        (b as { type?: string }).type === "tool_result",
    );
    if (results.length === 0) continue;
    const prev = out[i - 1];
    const useIds = new Set<string>();
    if (prev && prev.role === "assistant" && Array.isArray(prev.content)) {
      for (const b of prev.content) {
        if ((b as { type?: string }).type === "tool_use") {
          useIds.add((b as Anthropic.ToolUseBlock).id);
        }
      }
    }
    for (const r of results) {
      expect(useIds.has(r.tool_use_id), `orphan tool_result ${r.tool_use_id} at index ${i}`).toBe(
        true,
      );
    }
  }
}

describe("sanitizeHistory", () => {
  it("leaves a well-formed history untouched", () => {
    const input: Msg[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: [textBlock("checking"), toolUse("t1")] },
      { role: "user", content: [toolResult("t1")] },
      { role: "assistant", content: "done" },
    ];
    const out = sanitizeHistory(input);
    expect(out).toEqual(input);
  });

  it("PRODUCTION REGRESSION: window starting on an assistant tool_use message never leaves an orphan tool_result at messages[0]", () => {
    const input: Msg[] = [
      { role: "assistant", content: [toolUse("toolu_01D4")] },
      { role: "user", content: [toolResult("toolu_01D4")] },
      { role: "assistant", content: "answer prose" },
      { role: "user", content: "I've applied" },
    ];
    const out = sanitizeHistory(input);
    firstMessageIsLegal(out);
    allToolResultsResolved(out);
    // The user's real messages survive.
    expect(out[out.length - 1]).toEqual({ role: "user", content: "I've applied" });
  });

  it("head user message with mixed tool_result + text keeps the text", () => {
    const input: Msg[] = [
      { role: "assistant", content: [toolUse("a")] },
      { role: "user", content: [toolResult("a"), textBlock("also this")] },
      { role: "user", content: "next" },
    ];
    const out = sanitizeHistory(input);
    firstMessageIsLegal(out);
    allToolResultsResolved(out);
    expect(JSON.stringify(out)).toContain("also this");
  });

  it("drops a leading orphan tool-result row (window sliced after the tool_use)", () => {
    const input: Msg[] = [
      { role: "user", content: [toolResult("gone")] },
      { role: "assistant", content: "prose" },
      { role: "user", content: "hello" },
    ];
    const out = sanitizeHistory(input);
    firstMessageIsLegal(out);
    allToolResultsResolved(out);
  });

  it("strips dangling tool_use blocks (max_tokens stop persisted without results)", () => {
    const input: Msg[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: [textBlock("thinking"), toolUse("never-resolved")] },
      { role: "user", content: "are you there?" },
    ];
    const out = sanitizeHistory(input);
    allToolResultsResolved(out);
    // The tool_use is gone; the text survives.
    const assistant = out.find((m) => m.role === "assistant")!;
    expect(JSON.stringify(assistant.content)).not.toContain("tool_use");
    expect(JSON.stringify(assistant.content)).toContain("thinking");
  });

  it("parallel tool calls: partial results strip the whole tool_use set", () => {
    const input: Msg[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: [toolUse("a"), toolUse("b")] },
      { role: "user", content: [toolResult("a")] }, // b's result lost
      { role: "user", content: "next" },
    ];
    const out = sanitizeHistory(input);
    firstMessageIsLegal(out);
    allToolResultsResolved(out);
  });

  it("stacked leading assistants (deep tool chain at the window edge) still normalises legally", () => {
    const input: Msg[] = [
      { role: "assistant", content: [toolUse("x")] },
      { role: "user", content: [toolResult("x")] },
      { role: "assistant", content: [toolUse("y")] },
      { role: "user", content: [toolResult("y")] },
      { role: "assistant", content: "summary" },
      { role: "user", content: "thanks" },
    ];
    const out = sanitizeHistory(input);
    firstMessageIsLegal(out);
    allToolResultsResolved(out);
    expect(out[out.length - 1]).toEqual({ role: "user", content: "thanks" });
  });

  it("empty input returns empty output", () => {
    expect(sanitizeHistory([])).toEqual([]);
  });
});
