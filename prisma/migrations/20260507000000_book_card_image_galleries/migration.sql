-- v1.63.0: optional photo galleries on BUILD / SETUP / STAY cards.
-- Each gets a `fileIds TEXT[]` column that mirrors the v1.35.0
-- BookOutfitCard.fileIds pattern — forward-only references to File
-- ids; the rendering layer joins at read time.
--
-- The use case (per user request): centerpieces, place cards,
-- handmade signage, suit hire reference photos, bridal suite shots,
-- venue space layouts. The new <ImageGallery> component renders
-- thumbnails for image MIMEs and a chip-text fallback for the rest.
--
-- Purely additive — defaults to empty array, no data movement.

ALTER TABLE "BookBuildCard"
    ADD COLUMN "fileIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "BookSetupCard"
    ADD COLUMN "fileIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "BookStayCard"
    ADD COLUMN "fileIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
