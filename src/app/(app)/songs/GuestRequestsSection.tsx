"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { addGuestRequestToPlaylist, dismissGuestRequest } from "./actions";

type GuestRequest = {
  id: string;
  title: string;
  artist: string | null;
  guest: { id: string; firstName: string; lastName: string } | null;
};

type RequestPlaylist = { id: string; name: string; category: string };

// v2.6.0 (finding #1): this section used to be a dead end — its own copy
// told the user to "add the ones you want into your DJ's setlists above"
// but no control anywhere ever wrote SongRequest.playlistId, so nothing
// could ever leave the pending queue. Each request now gets a playlist
// picker + "Add" (creates a Song in that playlist and marks the request
// placed) and a "Dismiss" (clears it from the queue without adding a
// song) — see actions.ts for the write side.
export function GuestRequestsSection({
  requests,
  playlists,
  canEdit,
}: {
  requests: GuestRequest[];
  playlists: RequestPlaylist[];
  canEdit: boolean;
}) {
  // Group by guest so it's clear who suggested what. Same guest with three
  // requests (Q3 + Q5 + Q9 from Say I Do) shows once with three lines.
  const byGuest = new Map<string, { name: string; songs: GuestRequest[] }>();
  for (const r of requests) {
    const key = r.guest?.id ?? "anonymous";
    const name = r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Anonymous";
    if (!byGuest.has(key)) byGuest.set(key, { name, songs: [] });
    byGuest.get(key)!.songs.push(r);
  }
  const groups = Array.from(byGuest.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">Guest requests</h2>
        <p className="text-[11px] text-ink-tertiary">
          Imported from RSVPs (Q3 / Q5 / Q9 in the Say I Do export).
          {canEdit
            ? " Add the ones you want into a playlist, or dismiss the rest."
            : " Not yet reviewed by the couple."}
        </p>
      </header>
      <ul className="divide-y divide-border-soft">
        {groups.map((g) => (
          <li key={g.name} className="px-4 py-3">
            <div className="text-xs font-semibold text-ink-secondary mb-1">
              {g.name}{" "}
              <span className="text-ink-tertiary font-normal">
                · {g.songs.length} request{g.songs.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="space-y-1.5 pl-1">
              {g.songs.map((s) => (
                <RequestRow key={s.id} request={s} playlists={playlists} canEdit={canEdit} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RequestRow({
  request,
  playlists,
  canEdit,
}: {
  request: GuestRequest;
  playlists: RequestPlaylist[];
  canEdit: boolean;
}) {
  const mustPlay = playlists.find((p) => p.category === "MUST_PLAY");
  const [target, setTarget] = useState(mustPlay?.id ?? playlists[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function onAdd() {
    if (!target) return;
    startTransition(async () => {
      const result = await addGuestRequestToPlaylist({ requestId: request.id, playlistId: target });
      if (result.ok) notify("success", `Added "${request.title}" to ${result.playlistName}`);
      else notify("error", result.error);
    });
  }

  function onDismiss() {
    startTransition(async () => {
      const result = await dismissGuestRequest(request.id);
      if (result.ok) notify("success", `Dismissed "${request.title}"`);
      else notify("error", result.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-sm text-ink-primary leading-snug">
      <span className="min-w-0">
        <span className="text-ink-tertiary mr-1.5">♪</span>
        {request.title}
        {request.artist && <span className="text-ink-tertiary"> — {request.artist}</span>}
      </span>
      {/* v2.5.2 (review fix): Dismiss doesn't depend on any Playlist
          existing (dismissGuestRequest has no such dependency) — it
          was previously nested inside the `playlists.length > 0`
          gate alongside Add, so a couple with zero real playlists
          could never dismiss a request either. Only the
          playlist-picker + Add are actually playlist-dependent. */}
      {canEdit && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {playlists.length > 0 && (
            <>
              <select
                aria-label={`Playlist for "${request.title}"`}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={pending}
                className="text-xs bg-surface border border-border-soft rounded-sm px-1.5 py-1 min-h-[40px] sm:min-h-0 text-ink-primary outline-none disabled:opacity-45"
              >
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button variant="secondary" size="sm" onClick={onAdd} disabled={pending || !target}>
                Add
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onDismiss} disabled={pending}>
            Dismiss
          </Button>
        </div>
      )}
    </li>
  );
}
