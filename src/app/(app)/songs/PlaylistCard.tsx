"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createSong, deletePlaylist, deleteSong } from "./actions";

type Song = { id: string; title: string; artist: string | null; source: string | null };
type Playlist = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  isBlockList: boolean;
  songs: Song[];
};

const CATEGORY_LABEL: Record<string, string> = {
  MUST_PLAY: "Must play",
  FIRST_DANCE: "First dance",
  CEREMONY: "Ceremony",
  DO_NOT_PLAY: "Do not play",
  BRIDAL_PREP: "Bridal prep",
  DRINKS_RECEPTION: "Drinks reception",
  WEDDING_BREAKFAST: "Wedding breakfast",
};

export function PlaylistCard({ playlist, canEdit }: { playlist: Playlist; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDeletePlaylist() {
    if (!confirm(`Delete playlist "${playlist.name}" and all its songs?`)) return;
    startTransition(async () => {
      await deletePlaylist(playlist.id);
    });
  }

  function onDeleteSong(id: string, title: string) {
    if (!confirm(`Remove "${title}"?`)) return;
    startTransition(async () => {
      await deleteSong(id);
    });
  }

  const accent = playlist.isBlockList ? "border-danger/30 bg-danger-bg/30" : "border-border-soft bg-surface";

  return (
    <section className={`border ${accent} rounded-md shadow-sm`}>
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">{playlist.name}</h2>
          <div className="text-[11px] text-ink-tertiary">
            {CATEGORY_LABEL[playlist.category] ?? playlist.category} · {playlist.songs.length} {playlist.songs.length === 1 ? "song" : "songs"}
            {playlist.description ? ` · ${playlist.description}` : ""}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)} disabled={pending}>+ Song</Button>
            <Button variant="ghost" size="sm" onClick={onDeletePlaylist} disabled={pending}>Delete</Button>
          </div>
        )}
      </header>
      <ul className="divide-y divide-border-soft">
        {playlist.songs.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink-primary truncate">{s.title}</div>
              {s.artist && <div className="text-xs text-ink-tertiary truncate">{s.artist}</div>}
            </div>
            {s.source && <span className="text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1.5 py-px rounded-md">{s.source}</span>}
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => onDeleteSong(s.id, s.title)} disabled={pending}>×</Button>
            )}
          </li>
        ))}
        {playlist.songs.length === 0 && !adding && (
          <li className="px-4 py-3 text-xs text-ink-tertiary italic text-center">No songs yet.</li>
        )}
        {adding && (
          <li className="px-4 py-3 bg-moss-50/30">
            <NewSongForm playlistId={playlist.id} onDone={() => setAdding(false)} />
          </li>
        )}
      </ul>
    </section>
  );
}

function NewSongForm({ playlistId, onDone }: { playlistId: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => {
        fd.set("playlistId", playlistId);
        startTransition(async () => { await createSong(fd); onDone(); });
      }}
      className="flex flex-wrap gap-2 items-center"
    >
      <Input name="title" required autoFocus placeholder="Song title" className="!w-44" />
      <Input name="artist" placeholder="Artist" className="!w-36" />
      <Input name="source" placeholder="Requested by…" className="!w-36" />
      <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "…" : "Add"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>Cancel</Button>
    </form>
  );
}
