// v2.4.2: extracted from chat.ts (pure — unit-testable without Prisma).
//
// Makes a reconstructed chat history Anthropic-legal. Three ways
// stored rows go bad:
//   (a) a max_tokens stop persists an assistant row with tool_use
//       blocks whose tool_result rows never got written — replaying
//       that verbatim 400s every subsequent turn in the thread;
//   (b) the history window can slice a tool_use / tool_result pair
//       apart at its boundary;
//   (c) — the v2.4.2 production bug — the window starts ON an
//       assistant tool_use message: the pairing checks keep the pair,
//       then the "first message must be user" rule shifted the
//       assistant off the front, leaving its tool_result as
//       messages[0] — an orphan the API rejects ("unexpected
//       tool_use_id found in tool_result blocks"). Head
//       normalisation now re-strips orphaned tool_results after
//       every shift instead of assuming pairs stay intact.
// Healing happens at read time, so threads wedged by old truncated
// turns recover on their next message.

import type Anthropic from "@anthropic-ai/sdk";

type BlockLike = { type?: string };

export function sanitizeHistory(
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

  // Head normalisation. The first message must be role "user" AND must
  // not carry tool_result blocks — there is no previous message left to
  // hold their tool_use. Shifting a leading assistant can orphan the
  // tool_results that were paired with it, so re-check after EVERY
  // shift rather than assuming the pairing survives (the v2.4.2 bug).
  while (out.length > 0) {
    const first = out[0]!;
    if (first.role !== "user") {
      out.shift();
      continue;
    }
    if (Array.isArray(first.content)) {
      const blocks = first.content as BlockLike[];
      const kept = blocks.filter((b) => b.type !== "tool_result");
      if (kept.length === 0) {
        out.shift();
        continue;
      }
      if (kept.length !== blocks.length) {
        out[0] = {
          role: "user",
          content: kept as Anthropic.MessageParam["content"],
        };
      }
    }
    break;
  }
  return out;
}
