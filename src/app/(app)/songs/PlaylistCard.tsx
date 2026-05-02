"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createSong, deletePlaylist, deleteSong, moveSong, setPlaylistSpotifyUrl, syncPlaylistFromSpotify } from "./actions";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Song = { id: string; title: string; artist: string | null; source: string | null; spotifyUri: string | null };
type Playlist = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  isBlockList: boolean;
  spotifyId: string | null;
  spotifyUrl: string | null;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  lastSyncedSongs: number | null;
  songs: Song[];
};

function formatRelativeTime(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) return d.toLocaleString();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

const CATEGORY_LABEL: Record<string, string> = {
  MUST_PLAY: "Must play",
  FIRST_DANCE: "First dance",
  CEREMONY: "Ceremony",
  DO_NOT_PLAY: "Do not play",
  BRIDAL_PREP: "Bridal prep",
  DRINKS_RECEPTION: "Drinks reception",
  WEDDING_BREAKFAST: "Wedding breakfast",
};

export function PlaylistCard({
  playlist,
  canEdit,
  spotifyEnabled,
}: {
  playlist: Playlist;
  canEdit: boolean;
  spotifyEnabled: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingSpotify, setEditingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(playlist.lastSyncError);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onDeletePlaylist() {
    if (!(await confirm({
      title: `Delete playlist "${playlist.name}"?`,
      body: "All songs in this playlist will be removed too.",
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
    startTransition(async () => {
      await deletePlaylist(playlist.id);
    });
  }

  async function onDeleteSong(id: string, title: string) {
    if (!(await confirm({ title: `Remove "${title}"?`, confirmLabel: "Remove", tone: "danger" }))) return;
    startTransition(async () => {
      await deleteSong(id);
    });
  }

  function onMoveSong(id: string, delta: -1 | 1) {
    startTransition(async () => {
      await moveSong(id, delta);
    });
  }

  async function onSync() {
    const syncedCount = playlist.songs.filter((s) => s.spotifyUri).length;
    const otherCount = playlist.songs.filter((s) => !s.spotifyUri).length;
    const bodyParts: string[] = [];
    if (syncedCount > 0) {
      bodyParts.push(`${syncedCount} previously synced song${syncedCount === 1 ? "" : "s"} will be replaced with the current Spotify list.`);
    }
    if (otherCount > 0) {
      bodyParts.push(`${otherCount} manually-added song${otherCount === 1 ? "" : "s"} (no Spotify URI) will be kept.`);
    }
    if (!(await confirm({
      title: `Pull tracks from Spotify into "${playlist.name}"?`,
      body: bodyParts.length > 0 ? bodyParts.join("\n\n") : undefined,
      confirmLabel: "Sync",
    }))) return;
    setSpotifyError(null);
    startTransition(async () => {
      const result = await syncPlaylistFromSpotify(playlist.id);
      if (!result.ok) setSpotifyError(result.error);
    });
  }

  function onSpotifyUrlSubmit(formData: FormData) {
    const url = (formData.get("url") as string | null)?.trim() ?? "";
    setSpotifyError(null);
    startTransition(async () => {
      const result = await setPlaylistSpotifyUrl({ playlistId: playlist.id, url });
      if (!result.ok) {
        setSpotifyError(result.error);
        return;
      }
      setEditingSpotify(false);
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

      {/* Spotify panel — link, sync, last-synced state. Hidden entirely
          when neither configured nor linked to keep simple cards clean. */}
      {(spotifyEnabled || playlist.spotifyId) && canEdit && !playlist.isBlockList && (
        <div className="px-4 py-2.5 border-b border-border-soft bg-canvas/40 text-[11px] text-ink-tertiary">
          {!spotifyEnabled ? (
            <span className="italic">
              Spotify sync isn&apos;t configured on this server. Set{" "}
              <code className="bg-canvas border border-border-soft px-1 rounded">SPOTIFY_CLIENT_ID</code> +{" "}
              <code className="bg-canvas border border-border-soft px-1 rounded">SPOTIFY_CLIENT_SECRET</code> to enable.
            </span>
          ) : editingSpotify ? (
            <form
              action={onSpotifyUrlSubmit}
              className="flex flex-wrap gap-2 items-center"
            >
              <Input
                name="url"
                autoFocus
                placeholder="https://open.spotify.com/playlist/…"
                defaultValue={playlist.spotifyUrl ?? ""}
                className="!flex-1 !min-w-[200px]"
              />
              <Button type="submit" variant="primary" size="sm" disabled={pending}>
                {pending ? "…" : "Save"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingSpotify(false)} disabled={pending}>
                Cancel
              </Button>
            </form>
          ) : playlist.spotifyId ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-moss-700">🎵 Linked to Spotify</span>
              {playlist.spotifyUrl && (
                <a href={playlist.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-info hover:underline truncate max-w-[260px]">
                  {playlist.spotifyUrl}
                </a>
              )}
              <span className="flex-1" />
              {playlist.lastSyncedAt && !playlist.lastSyncError && (
                <span title={`${playlist.lastSyncedSongs ?? 0} tracks · ${new Date(playlist.lastSyncedAt).toLocaleString()}`}>
                  Synced {formatRelativeTime(new Date(playlist.lastSyncedAt))}
                </span>
              )}
              <Button variant="secondary" size="sm" onClick={onSync} disabled={pending}>
                {pending ? "Syncing…" : playlist.lastSyncedAt ? "Re-sync" : "Sync now"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingSpotify(true)} disabled={pending}>
                Edit URL
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="italic">No Spotify playlist linked.</span>
              <span className="flex-1" />
              <Button variant="secondary" size="sm" onClick={() => setEditingSpotify(true)} disabled={pending}>
                Link Spotify URL
              </Button>
            </div>
          )}
          {spotifyError && (
            <div className="mt-1.5 text-danger text-[11px]">⚠ {spotifyError}</div>
          )}
        </div>
      )}

      <ul className="divide-y divide-border-soft">
        {playlist.songs.map((s, i) => {
          const spotifyUrl = s.spotifyUri
            ? `https://open.spotify.com/track/${s.spotifyUri.replace(/^spotify:track:/, "")}`
            : null;
          const isFirst = i === 0;
          const isLast = i === playlist.songs.length - 1;
          return (
            <li key={s.id} className="flex items-center gap-2 px-4 py-2 group">
              <span className="text-[10px] text-ink-tertiary tabular-nums w-5 flex-shrink-0">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-primary truncate flex items-center gap-1.5">
                  {spotifyUrl ? (
                    <a
                      href={spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Spotify"
                      className="hover:text-moss-700 hover:underline"
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span>{s.title}</span>
                  )}
                  {s.spotifyUri && (
                    <span className="text-[9px] text-moss-700" title="Synced from Spotify">🎵</span>
                  )}
                </div>
                {s.artist && <div className="text-xs text-ink-tertiary truncate">{s.artist}</div>}
              </div>
              {s.source && <span className="text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1.5 py-px rounded-md">{s.source}</span>}
              {canEdit && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onMoveSong(s.id, -1)}
                    disabled={pending || isFirst}
                    title="Move up"
                    className="text-[10px] px-1 text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveSong(s.id, 1)}
                    disabled={pending || isLast}
                    title="Move down"
                    className="text-[10px] px-1 text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ↓
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSong(s.id, s.title)} disabled={pending}>×</Button>
                </div>
              )}
            </li>
          );
        })}
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
