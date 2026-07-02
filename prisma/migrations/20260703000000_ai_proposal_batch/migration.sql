-- v2.2.0: batch approvals for AI proposals.
--
-- One nullable grouping column + index. Proposals created in the same
-- AI action (one chat turn / one guest-list parse / one due-date run)
-- share a batchId so the review UIs can apply or dismiss them as one.
-- Null = singleton. Append-only, no backfill — safe on a live DB.

ALTER TABLE "AiProposal" ADD COLUMN "batchId" TEXT;

CREATE INDEX "AiProposal_batchId_idx" ON "AiProposal"("batchId");
