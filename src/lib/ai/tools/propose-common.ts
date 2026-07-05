// v2.4.0: shared guards for every propose_* tool.
//
// One place for the per-turn proposal cap and the canonical
// "no write permission" refusal, so ~40 tool files don't each carry
// their own copy (and can't drift).

import type { ToolContext, ToolResult } from "./types";

/** Hard per-turn ceiling on proposals one chat turn can create.
 *  Below BULK_CAP (50) on the apply side, so one turn's output is
 *  always approvable in a single bulk action. */
export const PROPOSAL_TURN_CAP = 30;

/** Returns an error ToolResult when the caller can't write or the
 *  turn's proposal budget is spent; null means "go ahead". Call at
 *  the top of every propose_* handler. Increments the shared counter
 *  on success, so call it exactly once per proposal created — for
 *  tools that create N proposals in one call (breakdown), pass n. */
export function takeProposalSlots(ctx: ToolContext, n = 1): ToolResult | null {
  if (!ctx.canWrite) {
    return {
      ok: false,
      error:
        "You don't have permission to write proposals in this app. Tell the user to ask the couple for ai_write access.",
    };
  }
  if (ctx.proposalsCreated) {
    if (ctx.proposalsCreated.count + n > PROPOSAL_TURN_CAP) {
      return {
        ok: false,
        error: `Proposal cap for this turn reached (${PROPOSAL_TURN_CAP}). Ask the user to review the pending batch first, or split the request across turns.`,
      };
    }
    ctx.proposalsCreated.count += n;
  }
  return null;
}
