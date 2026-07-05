// v2.6.0: split out of actions.ts — "use server" files may only export
// async functions, so a plain string const can't live there.
//
// SongRequest.playlistId is a real FK to Playlist, so "dismiss" (leave
// the triage queue without creating a Song) can't just write an
// arbitrary sentinel value — it has to point at a real row. actions.ts
// lazily creates one internal placeholder Playlist for that purpose;
// page.tsx filters it out of the normal playlist listing by name.
export const DISMISSED_SENTINEL_NAME =
  "Dismissed requests (internal — not a real playlist)";
