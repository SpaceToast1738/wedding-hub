-- v1.38.0 (P7b/B + P8): card upgrades for FIELD, RECIPE, SHOT_LIST,
-- plus the Post-wedding section. All schema additions are additive;
-- the only data move is the RECIPE steps Json → BookRecipeStep
-- table backfill, which is idempotent (gated on whether
-- BookRecipeStep already has rows for that recipe).

-- 1. FIELD upgrades — every column nullable / defaulted so existing
--    BookFieldDef rows pass without re-validation.
ALTER TABLE "BookFieldDef" ADD COLUMN "group"    TEXT;
ALTER TABLE "BookFieldDef" ADD COLUMN "helpText" TEXT;
ALTER TABLE "BookFieldDef" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BookFieldDef" ADD COLUMN "min"      DOUBLE PRECISION;
ALTER TABLE "BookFieldDef" ADD COLUMN "max"      DOUBLE PRECISION;
ALTER TABLE "BookFieldDef" ADD COLUMN "dateMin"  TIMESTAMP(3);
ALTER TABLE "BookFieldDef" ADD COLUMN "dateMax"  TIMESTAMP(3);

-- 2. SHOT_LIST upgrades — `category` + `estimatedMinutes` for
--    grouping & time-budget rollup, `guestIds` for forward link to
--    the guest list (matches BookStayCard.guestIds shape).
ALTER TABLE "BookShot" ADD COLUMN "category"         TEXT;
ALTER TABLE "BookShot" ADD COLUMN "estimatedMinutes" INTEGER;
ALTER TABLE "BookShot" ADD COLUMN "guestIds"         TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 3. RECIPE upgrades — `servingsBase` + new BookRecipeStep table.
ALTER TABLE "BookRecipe" ADD COLUMN "servingsBase" INTEGER;

CREATE TABLE "BookRecipeStep" (
    "id"              TEXT NOT NULL,
    "recipeId"        TEXT NOT NULL,
    "order"           INTEGER NOT NULL DEFAULT 0,
    "instruction"     TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "dayBefore"       BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BookRecipeStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookRecipeStep_recipeId_idx" ON "BookRecipeStep"("recipeId");

ALTER TABLE "BookRecipeStep"
    ADD CONSTRAINT "BookRecipeStep_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "BookRecipe"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Backfill BookRecipeStep from existing BookRecipe.steps Json.
--    The legacy column shape is `string[]`. Each string becomes one
--    BookRecipeStep row with `instruction = step`, `durationMinutes
--    = null`, `dayBefore = false`. Idempotent — the WHERE clause
--    skips recipes that already have at least one BookRecipeStep
--    row, so re-runs are no-ops. pgcrypto is loaded by the v1.35.0
--    migration so gen_random_bytes() is available here too.
DO $$
DECLARE
    rec_record  RECORD;
    step_value  TEXT;
    step_index  INTEGER;
BEGIN
    FOR rec_record IN
        SELECT r.id AS recipe_id, r.steps
        FROM "BookRecipe" r
        WHERE NOT EXISTS (
            SELECT 1 FROM "BookRecipeStep" s WHERE s."recipeId" = r.id
        )
        AND r.steps IS NOT NULL
        AND jsonb_typeof(r.steps::jsonb) = 'array'
    LOOP
        step_index := 0;
        FOR step_value IN
            SELECT jsonb_array_elements_text(rec_record.steps::jsonb)
        LOOP
            IF step_value IS NOT NULL AND length(trim(step_value)) > 0 THEN
                INSERT INTO "BookRecipeStep"
                    (id, "recipeId", "order", instruction, "durationMinutes", "dayBefore")
                VALUES
                    (
                        encode(gen_random_bytes(12), 'hex'),
                        rec_record.recipe_id,
                        step_index,
                        step_value,
                        NULL,
                        false
                    );
                step_index := step_index + 1;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 5. Post-wedding section. Idempotent insert — the seed creates it
--    too, but on a clean DB the migration runs first. ON CONFLICT
--    DO NOTHING keeps re-runs safe.
INSERT INTO "BookSection" (id, slug, title, "order", visibility, "createdAt", "updatedAt")
VALUES (
    encode(gen_random_bytes(12), 'hex'),
    'post-wedding',
    'Post-wedding',
    12,
    'EVERYONE',
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;
