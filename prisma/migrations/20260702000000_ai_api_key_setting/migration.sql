-- v2.1.0 phase 6.1: store Anthropic API key in-app.
--
-- Editable from /settings so the couple can rotate the key without
-- shelling into the Unraid box. Nullable; when NULL the runtime
-- falls back to the ANTHROPIC_API_KEY env var. Append-only,
-- backfill-free — safe on a live production DB.

ALTER TABLE "WeddingSettings" ADD COLUMN "anthropicApiKey" TEXT;
