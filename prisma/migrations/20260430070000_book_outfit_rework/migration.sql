-- v1.35.0 (P5): OUTFIT rework — one card per person.
--
-- Pre-v1.35.0 each BookOutfitCard held N children (BookOutfit rows),
-- one per wedding-party member. Now BookOutfitCard is per-person
-- (personName + role + fitting timeline + cost on the card) and
-- BookOutfit children describe per-item composition (dress / shoes /
-- accessories).
--
-- The data migration:
--
--   1. Single-child cards: leave alone. Copy the row's personName /
--      role onto the card.
--   2. 2+-child cards: for each child, create a new subsection under
--      `wedding-party-people` with title "{personName} — outfit".
--      Move the child to its own card. Original subsection's body
--      gets a "migrated" marker so the couple can review and delete.
--   3. Legacy BookOutfit.personName + role columns stay populated as
--      a recoverability buffer for one release.
--
-- The wedding-party-people section row is created by the seed
-- (seedBookSections runs before any data migration), but if it's
-- not yet present (a deploy that runs migrations before the seed
-- on a brand-new DB) the data migration becomes a no-op for any
-- 2+-child cards — they stay where they are. The seed re-run on
-- next deploy picks them up.

-- 0. The data migration below uses gen_random_bytes() from pgcrypto
--    to mint cuid-shaped IDs for new BookSection / BookSubsection /
--    BookOutfitCard rows. Stock Postgres 16 ships pgcrypto but does
--    not pre-load it (the CI test image is bare). Idempotent IF NOT
--    EXISTS keeps re-runs and richer environments happy.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Schema additions on BookOutfitCard.
ALTER TABLE "BookOutfitCard" ADD COLUMN "personName"       TEXT;
ALTER TABLE "BookOutfitCard" ADD COLUMN "role"             TEXT;
ALTER TABLE "BookOutfitCard" ADD COLUMN "fittingDate"      TIMESTAMP(3);
ALTER TABLE "BookOutfitCard" ADD COLUMN "alterationsDueBy" TIMESTAMP(3);
ALTER TABLE "BookOutfitCard" ADD COLUMN "pickupDate"       TIMESTAMP(3);
ALTER TABLE "BookOutfitCard" ADD COLUMN "costPence"        INTEGER;
ALTER TABLE "BookOutfitCard" ADD COLUMN "paidBy"           TEXT;
ALTER TABLE "BookOutfitCard" ADD COLUMN "paid"             BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BookOutfitCard" ADD COLUMN "fileIds"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BookOutfitCard" ADD COLUMN "notes"            TEXT;

-- 2. Schema additions on BookOutfit. itemLabel becomes the row
--    identity going forward; legacy personName / role / items fields
--    stay nullable so old rows persist.
ALTER TABLE "BookOutfit" ADD COLUMN "itemLabel"   TEXT;
ALTER TABLE "BookOutfit" ADD COLUMN "description" TEXT;
ALTER TABLE "BookOutfit" ALTER COLUMN "personName" DROP NOT NULL;

-- 3. Data migration. Run inside a DO block so we can use plpgsql
--    control-flow. Idempotent — gated on whether
--    BookOutfitCard.personName is already populated for the cards
--    we're about to touch.

-- Ensure the wedding-party-people target section exists. The seed
-- creates it too, but seed runs after migration on `db:reset` — so
-- on a clean DB upgrade we need the section in place before the
-- DO block walks 2+-children cards. Idempotent: ON CONFLICT skips
-- when the seed has already inserted it.
INSERT INTO "BookSection" (id, slug, title, "order", visibility, "createdAt", "updatedAt")
VALUES (
    encode(gen_random_bytes(12), 'hex'),
    'wedding-party-people',
    'Wedding Party — People',
    1,
    'EVERYONE',
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
    target_section_id  TEXT;
    card_record        RECORD;
    child_record       RECORD;
    new_subsection_id  TEXT;
    new_card_id        TEXT;
    next_order         INTEGER;
    child_count        INTEGER;
BEGIN
    -- Locate wedding-party-people section.
    SELECT id INTO target_section_id
        FROM "BookSection"
        WHERE slug = 'wedding-party-people'
        LIMIT 1;

    -- Walk every BookOutfitCard.
    FOR card_record IN
        SELECT c.id AS card_id, c."subsectionId" AS sub_id
        FROM "BookOutfitCard" c
        WHERE c."personName" IS NULL  -- skip cards already migrated
    LOOP
        SELECT COUNT(*) INTO child_count
            FROM "BookOutfit"
            WHERE "cardId" = card_record.card_id;

        IF child_count = 0 THEN
            -- Empty card. Nothing to copy. Move on.
            CONTINUE;

        ELSIF child_count = 1 THEN
            -- Single-person card. Copy the child's identity onto the
            -- parent card; convert the row to an item.
            FOR child_record IN
                SELECT id, "personName", role
                FROM "BookOutfit"
                WHERE "cardId" = card_record.card_id
            LOOP
                UPDATE "BookOutfitCard"
                    SET "personName" = child_record."personName",
                        "role"       = child_record.role
                    WHERE id = card_record.card_id;
                UPDATE "BookOutfit"
                    SET "itemLabel" = COALESCE("itemLabel", 'Outfit')
                    WHERE id = child_record.id;
            END LOOP;

        ELSE
            -- 2+-children card. Each child becomes a new card under
            -- wedding-party-people (if the section exists).
            IF target_section_id IS NULL THEN
                -- Bail — keep card where it is, do nothing. The seed
                -- creates the section; re-running the migration after
                -- the seed will pick this card up.
                CONTINUE;
            END IF;

            -- Find the next order under wedding-party-people so new
            -- subsections append to whatever's already there.
            SELECT COALESCE(MAX("order"), -1) INTO next_order
                FROM "BookSubsection"
                WHERE "sectionId" = target_section_id;

            FOR child_record IN
                SELECT id, "personName", role
                FROM "BookOutfit"
                WHERE "cardId" = card_record.card_id
                ORDER BY "order"
            LOOP
                next_order := next_order + 1;
                new_subsection_id := encode(gen_random_bytes(12), 'hex');
                new_card_id       := encode(gen_random_bytes(12), 'hex');

                INSERT INTO "BookSubsection"
                    (id, "sectionId", slug, title, kind, "order", visibility, "updatedAt")
                VALUES
                    (
                        new_subsection_id,
                        target_section_id,
                        -- slug = lower personName + "-outfit", with
                        -- trailing -N suffix if it collides.
                        regexp_replace(lower(child_record."personName"), '[^a-z0-9]+', '-', 'g') || '-outfit-' || substring(new_subsection_id from 1 for 4),
                        child_record."personName" || ' — outfit',
                        'OUTFIT',
                        next_order,
                        'EVERYONE',
                        NOW()
                    );

                INSERT INTO "BookOutfitCard"
                    (id, "subsectionId", "personName", role, paid, "fileIds")
                VALUES
                    (
                        new_card_id,
                        new_subsection_id,
                        child_record."personName",
                        child_record.role,
                        false,
                        ARRAY[]::TEXT[]
                    );

                UPDATE "BookOutfit"
                    SET "cardId"    = new_card_id,
                        "itemLabel" = COALESCE("itemLabel", 'Outfit')
                    WHERE id = child_record.id;
            END LOOP;

            -- Mark the original subsection so the couple knows to
            -- review + delete. Use the body field on its parent
            -- BookSubsection.
            UPDATE "BookSubsection"
                SET body = '_Migrated to per-person cards under Wedding Party — People. Review and delete this subsection if everything looks right._'
                WHERE id = card_record.sub_id;
        END IF;
    END LOOP;
END $$;
