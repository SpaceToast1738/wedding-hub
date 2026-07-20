-- v2.9.2: propose-nudge-send token capability.
--
-- One additive column, no backfill — safe on a live DB:
--   * McpToken.canProposeSend — gates the propose_nudge_send MCP tool,
--     the most side-effectful propose kind (Apply actually emails the
--     couple + planners the RSVP/overdue nudge digest). Off by default:
--     queuing a send proposal is an explicit per-token opt-in on top of
--     ai_write EDIT + couple-tier. Applying the queued send still needs
--     canApply (or a human clicks Apply on /ai). Independent of canApply
--     and canDismissOwn, both of which also keep defaulting false.

ALTER TABLE "McpToken" ADD COLUMN "canProposeSend" BOOLEAN NOT NULL DEFAULT false;
