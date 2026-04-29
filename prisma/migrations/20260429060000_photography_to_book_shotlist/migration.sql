-- v1.27.6 (originally planned as v1.26.5): migrate the bespoke
-- v0.13.0 PhotographyShot data into the v1.26.0 BookShot model
-- under a single SHOT_LIST card on the Photography section.
--
-- Idempotency strategy:
--   * Only run the data move if both (a) a Photography section
--     exists with slug='photography', AND (b) the section doesn't
--     already have a kind=SHOT_LIST subsection (so re-running this
--     migration is a no-op once the data has moved).
--
-- The legacy PhotographyShot table is left in place — a future
-- v1.28.0 schema-cleanup release will drop it once this migration
-- has been verified live for one release.
--
-- The bespoke /book/photography route files (page.tsx,
-- ShotsClient.tsx, actions.ts, PrintShotsButton.tsx) are deleted at
-- the application layer in the same release; once gone, /book/photography
-- resolves through the generic /book/[slug] route which renders the
-- migrated SHOT_LIST card.

DO $$
DECLARE
  photo_section_id TEXT;
  new_subsection_id TEXT;
  new_shotlist_id TEXT;
  next_order INTEGER;
BEGIN
  -- Look up the Photography section.
  SELECT id INTO photo_section_id
  FROM "BookSection"
  WHERE slug = 'photography'
  LIMIT 1;

  IF photo_section_id IS NULL THEN
    RAISE NOTICE 'No Photography section found — skipping migration.';
    RETURN;
  END IF;

  -- Idempotency: bail if a SHOT_LIST subsection already exists.
  IF EXISTS (
    SELECT 1 FROM "BookSubsection"
    WHERE "sectionId" = photo_section_id
    AND kind = 'SHOT_LIST'
  ) THEN
    RAISE NOTICE 'Photography already has a SHOT_LIST subsection — skipping migration.';
    RETURN;
  END IF;

  -- Skip if there are no PhotographyShot rows to migrate.
  IF NOT EXISTS (SELECT 1 FROM "PhotographyShot") THEN
    RAISE NOTICE 'No PhotographyShot rows — skipping migration.';
    RETURN;
  END IF;

  -- Compute the next order index so the new card appends rather than
  -- collides with existing TEXT subsections on Photography.
  SELECT COALESCE(MAX("order"), -1) + 1 INTO next_order
  FROM "BookSubsection"
  WHERE "sectionId" = photo_section_id;

  -- Create the new SHOT_LIST subsection. cuid()-style ids generated
  -- via gen_random_uuid + a stable prefix so they're recognisably
  -- migration-origin without colliding with Prisma cuid() output.
  new_subsection_id := 'mig_' || replace(gen_random_uuid()::text, '-', '');
  new_shotlist_id := 'mig_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO "BookSubsection" (
    "id", "sectionId", "slug", "title", "kind", "body", "fields",
    "order", "visibility", "updatedAt"
  ) VALUES (
    new_subsection_id,
    photo_section_id,
    'shot-list',
    'Shot list',
    'SHOT_LIST',
    NULL,
    NULL,
    next_order,
    'EVERYONE',
    NOW()
  );

  -- Create the BookShotList that links the subsection to the rows.
  INSERT INTO "BookShotList" ("id", "subsectionId")
  VALUES (new_shotlist_id, new_subsection_id);

  -- Copy every PhotographyShot into BookShot. Preserve title /
  -- withWhom / location / notes / captured / capturedAt / order.
  -- Generate fresh BookShot ids so they don't collide with anything
  -- the user might create on the new card after the migration runs.
  INSERT INTO "BookShot" (
    "id", "shotListId", "title", "withWhom", "location", "notes",
    "captured", "capturedAt", "order"
  )
  SELECT
    'mig_' || replace(gen_random_uuid()::text, '-', ''),
    new_shotlist_id,
    title,
    "withWhom",
    location,
    notes,
    captured,
    "capturedAt",
    "order"
  FROM "PhotographyShot"
  ORDER BY "order" ASC, "createdAt" ASC;

  RAISE NOTICE 'Migrated PhotographyShot rows into BookShot under subsection %.', new_subsection_id;
END $$;
