-- v2.0.0: drop the LEGAL card kind from the Wedding Book.
--
-- The v1.34.0 LEGAL kind was pre-seeded with UK marriage-law content
-- ("Notice of Marriage", per-person marriage certificate docs,
-- Warwickshire Registrar contact). The couple asked for it gone —
-- "not sure this is UK Centric". Full removal:
--
--   1. DELETE every BookSubsection row whose kind = 'LEGAL'. The
--      cascade rules in the schema take care of the rest:
--        BookSubsection.kind=LEGAL → BookLegalCard (Cascade)
--                                  → BookLegalItem (Cascade)
--      File rows referenced by BookLegalItem.fileId are not deleted
--      (Files survive because the FK from item → file is SetNull,
--      and we're dropping the item rows entirely so the SetNull is
--      a no-op).
--
--   2. DROP TABLE the two per-kind tables.
--
--   3. Recreate the BookSubsectionKind enum without 'LEGAL'. Postgres
--      doesn't support ALTER TYPE ... DROP VALUE on an enum in use by
--      a column, so the rename-recreate-cast-drop dance is necessary.
--      Step 1 already cleared every row that would have failed the
--      cast.
--
-- Data destruction warning: any user-authored content in LEGAL cards
-- on production is permanently dropped here. The couple confirmed
-- they're OK with that (the seeded UK content was never customised
-- beyond the defaults in their environment).

DELETE FROM "BookSubsection" WHERE "kind" = 'LEGAL';

DROP TABLE "BookLegalItem";
DROP TABLE "BookLegalCard";

ALTER TYPE "BookSubsectionKind" RENAME TO "BookSubsectionKind_old";
CREATE TYPE "BookSubsectionKind" AS ENUM (
  'TEXT',
  'FIELD',
  'RECIPE',
  'SHOT_LIST',
  'OUTFIT',
  'BUILD',
  'MENU',
  'BAR',
  'SETUP',
  'STAY',
  'LODGING_GUIDE',
  'DRESS_CODE',
  'WEDDING_PARTY'
);
ALTER TABLE "BookSubsection"
  ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "BookSubsection"
  ALTER COLUMN "kind" TYPE "BookSubsectionKind"
  USING "kind"::text::"BookSubsectionKind";
ALTER TABLE "BookSubsection"
  ALTER COLUMN "kind" SET DEFAULT 'TEXT';
DROP TYPE "BookSubsectionKind_old";
