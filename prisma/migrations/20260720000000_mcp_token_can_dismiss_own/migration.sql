-- v2.9.0: dismiss-own-proposals token capability.
--
-- One additive column, no backfill — safe on a live DB:
--   * McpToken.canDismissOwn — exposes ONLY the dismiss_proposals MCP
--     tool, restricted to proposals created by the token's own user.
--     A propose-only agent can withdraw its own mistakes without
--     gaining any apply power. Defaults false, independent of
--     canApply (which also keeps defaulting false — the standing
--     safety invariant).

ALTER TABLE "McpToken" ADD COLUMN "canDismissOwn" BOOLEAN NOT NULL DEFAULT false;
