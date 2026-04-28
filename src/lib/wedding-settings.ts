// v1.20.0: app-wide wedding details, DB-backed.
//
// Pre-v1.20.0 these lived as `WEDDING_DATE` / `WEDDING_VENUE` /
// `WEDDING_COUPLE` env vars read directly at module scope by every
// page that needed them. Editing meant redeploying. This module
// centralises the read so every reference goes through one cached
// loader, and the user can edit the values via Settings without
// touching the server.
//
// Bootstrap behaviour: if no row exists in `WeddingSettings` (e.g.
// fresh DB before the migration's seed runs, or the row was wiped),
// `getWeddingSettings()` falls through to env-var defaults so the
// app still renders. The seed inserts a row from the same env vars,
// so the fallback usually isn't hit in production.

import { cache } from "react";
import { db } from "@/lib/db";

export type WeddingSettings = {
  weddingDate: Date;
  ceremonyTime: string;
  venue: string;
  venueAddress: string | null;
  coupleLabel: string;
  coupleShort: string;
  brideFirst: string;
  groomFirst: string;
};

function envDefaults(): WeddingSettings {
  const dateStr = process.env.WEDDING_DATE ?? "2026-09-26T14:00:00Z";
  return {
    weddingDate: new Date(dateStr),
    ceremonyTime: process.env.WEDDING_CEREMONY_TIME ?? "2:00pm ceremony",
    venue: process.env.WEDDING_VENUE ?? "Alveston Manor",
    venueAddress: process.env.WEDDING_VENUE_ADDRESS ?? null,
    coupleLabel: process.env.WEDDING_COUPLE ?? "Spencer · Olwyn-Davis Wedding",
    coupleShort: process.env.WEDDING_COUPLE_SHORT ?? "Jamie & Bryony's Wedding",
    brideFirst: process.env.WEDDING_BRIDE_FIRST ?? "Bryony",
    groomFirst: process.env.WEDDING_GROOM_FIRST ?? "Jamie",
  };
}

// React.cache() dedupes the lookup within a single request — every
// page on the same render gets the same row without N round-trips.
export const getWeddingSettings = cache(async (): Promise<WeddingSettings> => {
  try {
    const row = await db.weddingSettings.findUnique({ where: { id: 1 } });
    if (!row) return envDefaults();
    return {
      weddingDate: row.weddingDate,
      ceremonyTime: row.ceremonyTime,
      venue: row.venue,
      venueAddress: row.venueAddress,
      coupleLabel: row.coupleLabel,
      coupleShort: row.coupleShort,
      brideFirst: row.brideFirst,
      groomFirst: row.groomFirst,
    };
  } catch {
    // The fallback covers the rare case of a DB hiccup mid-render —
    // we'd rather show env defaults than crash the page.
    return envDefaults();
  }
});

// Helpers for formatted variants used in multiple places. Keeping the
// formatting here so a single change rolls everywhere.
export function formatWeddingDate(s: WeddingSettings): string {
  return s.weddingDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatWeddingDateShort(s: WeddingSettings): string {
  return s.weddingDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
