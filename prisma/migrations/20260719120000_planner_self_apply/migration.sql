-- v2.8.0: MCP self-apply groundwork.
--
-- Two additive columns, no backfill — safe on a live DB:
--   * McpToken.canApply — the apply/dismiss MCP tools are refused
--     without it. Per-token, defaults false, so future planner /
--     wedding-party tokens stay read+propose-only unless explicitly
--     opted in from Settings.
--   * AiProposal.metadata — delete-kind apply handlers snapshot the
--     deleted entity's full JSON (metadata.deletedSnapshot) here
--     before deleting, keeping destructive applies manually
--     recoverable from the proposal row.

ALTER TABLE "McpToken" ADD COLUMN "canApply" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AiProposal" ADD COLUMN "metadata" JSONB;
