-- v1.93.1: per-item cost on BookOutfit. The card-level costPence
-- still drives the linked BudgetLine sync (v1.78.0 syncBudgetLine
-- path is unchanged), but the couple can now optionally itemise
-- spend per row — e.g. £400 dress + £80 shoes + £30 jewellery rolling
-- up to a £510 outfit total. View mode shows an items-total chip
-- when at least one item has a cost set, so the discrepancy with the
-- manual card-level number is visible at a glance.

ALTER TABLE "BookOutfit" ADD COLUMN "costPence" INTEGER;
