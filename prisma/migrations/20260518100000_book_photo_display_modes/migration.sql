-- v1.97.0: photo display modes on every BookSubsection. The
-- v1.96.4 photoSize column controls thumbnail dimensions inside
-- `gallery` mode; these new columns choose the mode itself plus
-- two mode-specific knobs (header pin + slideshow autoplay).
--
-- All three columns are additive with safe defaults so unmigrated
-- cards render identically to v1.96.5 (`gallery` mode, no pin, no
-- autoplay).
ALTER TABLE "BookSubsection" ADD COLUMN "photoDisplay" TEXT NOT NULL DEFAULT 'gallery';
ALTER TABLE "BookSubsection" ADD COLUMN "headerFileId" TEXT;
ALTER TABLE "BookSubsection" ADD COLUMN "slideshowAuto" BOOLEAN NOT NULL DEFAULT false;
