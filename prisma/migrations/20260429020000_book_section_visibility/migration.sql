-- v1.24.0: BookSection couple-only audience override.
-- Mirrors the C1/v1.14.0 BookSubsection.visibility column so a couple
-- can hide an entire section (not just individual subsections).
-- Default EVERYONE so existing rows stay visible.

ALTER TABLE "BookSection"
  ADD COLUMN "visibility" "BookSubsectionVisibility" NOT NULL DEFAULT 'EVERYONE';
