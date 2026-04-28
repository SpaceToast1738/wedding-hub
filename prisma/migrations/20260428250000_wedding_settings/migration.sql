-- v1.20.0: app-wide singleton for wedding details. Singleton enforced
-- via id INTEGER PRIMARY KEY DEFAULT 1 — reads always use
-- findUnique({ where: { id: 1 } }); subsequent inserts collide on the PK.
-- Seed inserts the bootstrap row from env-var defaults.

CREATE TABLE "WeddingSettings" (
  "id"            INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "weddingDate"   TIMESTAMP(3) NOT NULL,
  "ceremonyTime"  TEXT NOT NULL DEFAULT '2:00pm ceremony',
  "venue"         TEXT NOT NULL,
  "venueAddress"  TEXT,
  "coupleLabel"   TEXT NOT NULL DEFAULT 'Spencer · Olwyn-Davis Wedding',
  "coupleShort"   TEXT NOT NULL DEFAULT 'Jamie & Bryony''s Wedding',
  "brideFirst"    TEXT NOT NULL DEFAULT 'Bryony',
  "groomFirst"    TEXT NOT NULL DEFAULT 'Jamie',
  "updatedAt"     TIMESTAMP(3) NOT NULL
);
