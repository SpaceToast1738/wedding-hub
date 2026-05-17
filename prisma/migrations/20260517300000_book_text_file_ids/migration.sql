-- v1.96.1: TEXT cards get a photo gallery. fileIds lives directly on
-- BookSubsection (rather than a new per-kind table) because TEXT's
-- content already lives on the row itself (body / bodyHtml) — adding
-- a sibling column keeps the read path single-query. Other kinds
-- continue to use their own per-kind fileIds (OUTFIT / DRESS_CODE /
-- etc.) — those tables are untouched, and this column is just
-- ignored for non-TEXT kinds. Empty-array default matches the
-- per-kind tables' convention.
ALTER TABLE "BookSubsection" ADD COLUMN "fileIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
