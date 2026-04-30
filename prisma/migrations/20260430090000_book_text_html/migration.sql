-- v1.37.0 (P7a): TEXT cards switch from a plain-text `body` column to
-- a sanitised-HTML `bodyHtml` column authored via a Tiptap WYSIWYG.
--
-- This is the second of two migrations in the Book expansion arc that
-- aren't strictly additive (the first was P5's OUTFIT split). The
-- legacy `body` column is **kept** for one release as a recoverability
-- buffer, mirroring the v1.30.5 standing pattern. From this release
-- on, the TEXT editor writes only to `bodyHtml`.
--
-- Backfill is done in SQL here (rather than in TS) so the migration
-- runs the same on every environment without depending on a separate
-- `tsx` step. The transform is deliberately conservative — escape
-- `<`, `>`, `&`, then convert paragraph + line breaks. Idempotent on
-- re-run because the `WHERE` clause skips rows that already have a
-- non-null `bodyHtml`.

-- 1. Schema addition.
ALTER TABLE "BookSubsection" ADD COLUMN "bodyHtml" TEXT;

-- 2. Backfill. For every TEXT subsection with a non-null body, build
--    HTML in three passes:
--      a. Escape `&`, `<`, `>` (in that order — `&` first so it
--         doesn't double-escape later passes).
--      b. Replace blank-line paragraph breaks (`\n\n`) with
--         `</p><p>`.
--      c. Replace remaining single newlines with `<br>`.
--      d. Wrap the whole thing in `<p>…</p>`.
--    Idempotent because we skip rows that already have bodyHtml.
UPDATE "BookSubsection"
SET "bodyHtml" =
    '<p>' ||
    regexp_replace(
        regexp_replace(
            replace(
                replace(
                    replace(body, '&', '&amp;'),
                    '<', '&lt;'
                ),
                '>', '&gt;'
            ),
            E'\n\n', '</p><p>', 'g'
        ),
        E'\n', '<br>', 'g'
    ) ||
    '</p>'
WHERE "kind" = 'TEXT'
  AND "body" IS NOT NULL
  AND "bodyHtml" IS NULL;
