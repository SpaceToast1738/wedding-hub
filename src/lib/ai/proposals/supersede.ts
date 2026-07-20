// v2.9.0: proposal supersede — the MCP route accepts an optional
// `supersedesProposalId` in any propose_* call's arguments; once the
// NEW proposal exists, the referenced old one (still PENDING, created
// by the same token's user) is dismissed with a "superseded by <id>"
// note in its metadata. Lets an agent refine a pending proposal
// without a canApply/canDismissOwn token and without leaving stale
// duplicates in the review queue.
//
// "Same token" is approximated as "same user": AiProposal rows record
// createdById, not the minting token, so a user's second token can
// supersede their first token's proposals — acceptable for this
// deployment (tokens are per-member, issued by the couple).
//
// Kept in its own module (db + audit + staging only) so the MCP route
// can dynamic-import it without dragging the apply-engine graph in —
// same reasoning as apply-proposals.ts's loadEngine().

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { discardStage, stagedNameFromPayload } from "@/lib/ai/uploads-staging";

export type SupersedeResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function supersedeProposal(
  userId: string,
  oldId: string,
  newId: string,
): Promise<SupersedeResult> {
  const old = await db.aiProposal.findUnique({
    where: { id: oldId },
    select: { id: true, status: true, createdById: true, kind: true, payload: true },
  });
  // Foreign rows get the same "not found" as missing ones — existence
  // is never leaked (mirrors loadOwnedProposal's ownership check).
  if (!old || old.createdById !== userId) {
    return { ok: false, reason: "Proposal not found." };
  }
  if (old.status !== "PENDING") {
    return { ok: false, reason: `Proposal is already ${old.status.toLowerCase()}.` };
  }

  // Atomic claim — same race protection as apply/dismiss. A PENDING
  // row can only carry rolled-back metadata (cleared by rollbackClaim),
  // so overwriting it here is safe.
  const claimed = await db.aiProposal.updateMany({
    where: { id: oldId, status: "PENDING", createdById: userId },
    data: {
      status: "DISMISSED",
      reviewedAt: new Date(),
      metadata: { note: `superseded by ${newId}`, supersededById: newId },
    },
  });
  if (claimed.count === 0) {
    return { ok: false, reason: "Proposal was already handled." };
  }

  // Same staged-upload cleanup a normal dismiss runs.
  if (old.kind === "file.upload") {
    const stagedName = stagedNameFromPayload(old.payload);
    if (stagedName) await discardStage(stagedName);
  }

  await logAudit({
    userId,
    action: "ai.proposal.superseded",
    entity: "AiProposal",
    entityId: oldId,
    metadata: { kind: old.kind, supersededById: newId },
  });
  revalidatePath("/ai");
  return { ok: true };
}
