-- v1.93.0: simplify the OUTFIT card.
--
-- User feedback: "Lets simplify the outfit section, I want to be able
-- to plan each item, mark if we have paid for it, or recieved it,
-- description, supplier and web link, maybe pictures too, remove
-- fitting alterations and pickup, anything with dates as these can
-- be managed via tasks."
--
-- (1) Map BookOutfit.status to the new lifecycle set
--     (Planned / Purchased / Received / Already own) before dropping
--     the alreadyOwned boolean — it's subsumed by status='Already own'.
-- (2) Drop the date + paid columns on BookOutfitCard. Fitting /
--     alterations / pickup live as Tasks now (Topic-linked back to
--     the OUTFIT card via the existing v1.51.0 Task ↔ BookSubsection
--     m2m). Paid tracking flows exclusively via the v1.75.0
--     Payment.bookOutfitId per-item link + v1.78.0 card → BudgetLine
--     sync — no separate card-level paid boolean needed.

UPDATE "BookOutfit" SET "status" = 'Planned'      WHERE "status" = 'Designed';
UPDATE "BookOutfit" SET "status" = 'Purchased'    WHERE "status" = 'Ordered';
UPDATE "BookOutfit" SET "status" = 'Received'     WHERE "status" = 'Fitted';
UPDATE "BookOutfit" SET "status" = 'Received'     WHERE "status" = 'Collected';
-- alreadyOwned wins: if both flag + a different status are set, the
-- explicit Already-own marker takes priority.
UPDATE "BookOutfit" SET "status" = 'Already own'  WHERE "alreadyOwned" = true;

ALTER TABLE "BookOutfit"     DROP COLUMN IF EXISTS "alreadyOwned";
ALTER TABLE "BookOutfitCard" DROP COLUMN IF EXISTS "fittingDate";
ALTER TABLE "BookOutfitCard" DROP COLUMN IF EXISTS "alterationsDueBy";
ALTER TABLE "BookOutfitCard" DROP COLUMN IF EXISTS "pickupDate";
ALTER TABLE "BookOutfitCard" DROP COLUMN IF EXISTS "paid";
ALTER TABLE "BookOutfitCard" DROP COLUMN IF EXISTS "paidBy";
