-- v1.32.2: per-head pricing + timing on BookBarItem. Both nullable,
-- additive — existing items render unchanged.

ALTER TABLE "BookBarItem" ADD COLUMN "pricePerHeadPence" INTEGER;
ALTER TABLE "BookBarItem" ADD COLUMN "timing" TEXT;
