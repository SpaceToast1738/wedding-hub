// v2.1.0 phase 1: read-tool registry.
//
// Collects every AI-callable tool in one place, exports the Anthropic
// tool definitions the chat loop passes to the API, and dispatches
// tool_use blocks back to the right handler. Phase 2 adds write
// tools (propose-task, propose-event) via the same interface.

import type Anthropic from "@anthropic-ai/sdk";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { readTasks } from "./read-tasks";
import { readEvents } from "./read-events";
import { readGuests } from "./read-guests";
import { readBook } from "./read-book";
import { readBudget } from "./read-budget";
import { readStats } from "./read-stats";
import { proposeTask } from "./propose-task";
import { proposeTaskUpdate } from "./propose-task-update";
import { proposeEvent } from "./propose-event";

// AiTool<TSchema> is invariant in TSchema, so a heterogeneous list of
// tools with different Zod object shapes can't share a single default
// binding. `any` here loses input-type info at the registry boundary,
// which is fine — the handler is dispatched by name + safeParse'd
// against the tool's own schema before it's called.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const READ_TOOLS: AiTool<any>[] = [
  readStats,
  readTasks,
  readEvents,
  readGuests,
  readBook,
  readBudget,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WRITE_TOOLS: AiTool<any>[] = [proposeTask, proposeTaskUpdate, proposeEvent];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_TOOLS: AiTool<any>[] = [...READ_TOOLS, ...WRITE_TOOLS];

const BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t] as const));

/** Return tool definitions to expose to the model.
 *  When `canWrite` is false, propose_* tools are hidden entirely —
 *  the model can't call them, so it won't try. Handlers still gate
 *  again as belt-and-braces. */
export function toolDefinitions(opts?: { canWrite?: boolean }): Anthropic.Tool[] {
  const tools = opts?.canWrite ? ALL_TOOLS : READ_TOOLS;
  return tools.map((t) => t.definition);
}

/** Tool names classified as "creates a proposal". Used by the chat
 *  loop to emit a proposal_created SSE event after a successful call. */
const PROPOSE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));
export function isProposeTool(name: string): boolean {
  return PROPOSE_TOOL_NAMES.has(name);
}

export function progressLabelFor(name: string): string {
  return BY_NAME.get(name)?.progressLabel ?? `Running ${name}…`;
}

/** Look up a tool by name and run it. Returns a text-serialisable
 *  string suitable for a tool_result content block. */
export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<{ result: ToolResult; text: string }> {
  const tool = BY_NAME.get(name);
  if (!tool) {
    const result: ToolResult = { ok: false, error: `Unknown tool: ${name}` };
    return { result, text: JSON.stringify(result) };
  }

  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    const result: ToolResult = {
      ok: false,
      error: `Invalid input for ${name}: ${parsed.error.message}`,
    };
    return { result, text: JSON.stringify(result) };
  }

  try {
    const result = await tool.handler(parsed.data, ctx);
    return { result, text: JSON.stringify(result) };
  } catch (err) {
    const result: ToolResult = {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown tool error.",
    };
    return { result, text: JSON.stringify(result) };
  }
}
