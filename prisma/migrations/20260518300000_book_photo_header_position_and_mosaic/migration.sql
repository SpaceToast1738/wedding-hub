-- v1.99.4: header positioning + mosaic body mode + header-becomes-additive.
--
-- Two coordinated schema changes:
--
-- (1) New BookSubsection.headerPosition column for 9-point hero
--     positioning (TL / T / TR / L / C / R / BL / B / BR). Maps to CSS
--     object-position at render time. Defaults to "center" so existing
--     rows pick up the pre-fix behaviour unchanged.
--
-- (2) photoDisplay drops "header" as a body mode. Pre-v1.99.4 the
--     enum-like column held one of gallery / header / slideshow,
--     exclusively. The "header" mode hid the body entirely and showed
--     only the hero image.
--
--     v1.99.4 makes header additive — controlled by headerFileId
--     being non-null, regardless of body mode. Existing rows with
--     photoDisplay='header' need to land on a real body mode; we pick
--     'gallery' because those rows had a pinned image anyway, so the
--     hero still renders post-migration and the body just resolves to
--     a thumbnail grid rather than being suppressed. Strictly more
--     visible than the pre-migration state.
--
--     New value "mosaic" is added to the allowlist at the action
--     layer; no DB constraint to update (column stays plain TEXT).

ALTER TABLE "BookSubsection"
  ADD COLUMN "headerPosition" TEXT NOT NULL DEFAULT 'center';

UPDATE "BookSubsection"
  SET "photoDisplay" = 'gallery'
  WHERE "photoDisplay" = 'header';
