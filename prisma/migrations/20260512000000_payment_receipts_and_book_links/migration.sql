-- v1.75.0: Payment gains receipts (fileIds) and optional links to
-- BookBuildMaterial / BookOutfit (per-item) so micropurchases can
-- claim the thing they paid for. Additive — no data backfill.

ALTER TABLE "Payment" ADD COLUMN "fileIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Payment" ADD COLUMN "bookBuildMaterialId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "bookOutfitId" TEXT;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookBuildMaterialId_fkey"
  FOREIGN KEY ("bookBuildMaterialId") REFERENCES "BookBuildMaterial"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookOutfitId_fkey"
  FOREIGN KEY ("bookOutfitId") REFERENCES "BookOutfit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_bookBuildMaterialId_idx" ON "Payment"("bookBuildMaterialId");
CREATE INDEX "Payment_bookOutfitId_idx" ON "Payment"("bookOutfitId");
