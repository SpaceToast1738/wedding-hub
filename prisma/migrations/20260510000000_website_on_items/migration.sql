-- v1.71.0: add optional website URL to item models across the Wedding Book.
-- Additive nullable columns — no data migration required.
ALTER TABLE "BookOutfit" ADD COLUMN "website" TEXT;
ALTER TABLE "BookBuildMaterial" ADD COLUMN "website" TEXT;
ALTER TABLE "BookBarItem" ADD COLUMN "website" TEXT;
ALTER TABLE "BookSetupItem" ADD COLUMN "website" TEXT;
