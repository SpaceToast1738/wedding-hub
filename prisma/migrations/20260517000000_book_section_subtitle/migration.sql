-- v1.94.0: per-section subtitle. Pre-fix the line under each section
-- title on /book came from a hard-coded SECTION_META map keyed by
-- slug ("Reference notes" generic fallback for most). Now editable —
-- the DB value wins; SECTION_META is the fallback when subtitle IS NULL.
ALTER TABLE "BookSection" ADD COLUMN "subtitle" TEXT;
