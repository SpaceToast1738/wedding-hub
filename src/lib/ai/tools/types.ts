// v2.1.0 phase 1: tool contract.
//
// Every AI tool is defined by a name, a Zod input schema (validated
// before dispatch), an Anthropic tool definition (the JSON Schema the
// model sees), and a handler that returns a small JSON-serialisable
// summary. Handlers never throw — they return { ok: false, error }
// so the chat loop can hand the model something useful when a query
// hits a bad argument.

import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { SessionUser } from "@/lib/actions";

export type ToolContext = {
  user: SessionUser;
  /** True when the caller has EDIT on ai_write. Read tools ignore
   *  this today but the field is threaded so proposal-writing tools
   *  in phase 2 don't need a signature change. */
  canWrite: boolean;
  /** v2.2.0: shared id stamped on every proposal created in one chat
   *  turn (or one one-shot run) so the review UIs can group them into
   *  a single approve-all card. Absent → proposals are singletons. */
  batchId?: string;
  /** v2.4.0: mutable per-turn proposal counter shared by every propose
   *  tool in one chat turn. Tools refuse past PROPOSAL_TURN_CAP so a
   *  runaway turn can't flood the review queue. Absent → uncapped
   *  (one-shots manage their own caps). */
  proposalsCreated?: { count: number };
};

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

export type AiTool<TInputSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  definition: Anthropic.Tool;
  handler: (input: z.infer<TInputSchema>, ctx: ToolContext) => Promise<ToolResult>;
  /** One-line summary shown in the chat panel while the tool runs
   *  (e.g. "Reading tasks…"). Kept short. */
  progressLabel: string;
};

