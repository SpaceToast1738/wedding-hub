-- C1 (v1.14.0): per-page audience override on Wedding Book subsections.
-- Mirrors FileVisibility. Couple-only pages get filtered out at read
-- time for non-couple users. Default EVERYONE keeps existing rows
-- visible.
CREATE TYPE "BookSubsectionVisibility" AS ENUM ('EVERYONE', 'COUPLE_ONLY');

ALTER TABLE "BookSubsection"
  ADD COLUMN "visibility" "BookSubsectionVisibility" NOT NULL DEFAULT 'EVERYONE';

-- C4 (v1.14.0): per-field manual-edit timestamps on Guest. JSON shape
-- is { "fieldName": "<ISO timestamp>", … }. Used by the import preview
-- to warn "you edited dietary 3 weeks ago — overwrite?". Nullable so
-- existing rows aren't forced to commit; the next manual edit
-- populates it field-by-field.
ALTER TABLE "Guest" ADD COLUMN "lastEditedFields" JSONB;
