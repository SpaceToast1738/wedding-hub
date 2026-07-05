"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { notify } from "@/lib/notify";
import { createPlaylist, createSong } from "./actions";

const CATEGORIES = [
  { value: "MUST_PLAY", label: "Must play" },
  { value: "FIRST_DANCE", label: "First dance" },
  { value: "CEREMONY", label: "Ceremony" },
  { value: "DO_NOT_PLAY", label: "Do not play" },
  { value: "BRIDAL_PREP", label: "Bridal prep" },
  { value: "DRINKS_RECEPTION", label: "Drinks reception" },
  { value: "WEDDING_BREAKFAST", label: "Wedding breakfast" },
];

// v2.6.0: demoted to secondary — "New playlist" is a rare, once-per-
// playlist action, while adding a song (AddSongToggle below) is the
// actually-frequent one and now holds the header's primary slot.
// v1.56.0: shared AddNewModal popout — was inline-expand previously.
export function AddPlaylistToggle() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        + New playlist
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title="New playlist" width="md">
        <form
          action={(fd) =>
            startTransition(async () => {
              await createPlaylist(fd);
              setOpen(false);
            })
          }
          className="space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Name</label>
              <Input name="name" required autoFocus placeholder="e.g. Bridal prep mix" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Category</label>
              <select name="category" required className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Description</label>
            <Input name="description" placeholder="Optional" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Saving…" : "Create"}</Button>
          </div>
        </form>
      </AddNewModal>
    </>
  );
}

// v2.6.0: header's primary CTA (finding #7) — adding a song is the
// frequent action on this page, but previously required scrolling down
// to a specific playlist card's small ghost "+ Song" button. This puts
// it one click away from the header, with a playlist picker defaulting
// to Must Play so the common case doesn't need any scrolling at all.
export function AddSongToggle({
  playlists,
}: {
  playlists: { id: string; name: string; category: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const mustPlay = playlists.find((p) => p.category === "MUST_PLAY");
  const defaultPlaylistId = mustPlay?.id ?? playlists[0]?.id ?? "";

  if (playlists.length === 0) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + Add song
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title="Add song" width="md">
        <form
          action={(fd) =>
            startTransition(async () => {
              const title = (fd.get("title") as string | null) ?? "";
              await createSong(fd);
              notify("success", `Added "${title}"`);
              setOpen(false);
            })
          }
          className="space-y-3"
        >
          <Input name="title" label="Title" required autoFocus placeholder="Song title" />
          <Input name="artist" label="Artist" placeholder="Optional" />
          <div>
            <label
              htmlFor="add-song-playlist"
              className="block text-[11px] font-bold text-ink-secondary uppercase tracking-wider mb-1"
            >
              Playlist
            </label>
            <select
              id="add-song-playlist"
              name="playlistId"
              required
              defaultValue={defaultPlaylistId}
              className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2.5 py-1.5 min-h-[40px] sm:min-h-0 text-ink-primary outline-none"
            >
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Saving…" : "Add"}</Button>
          </div>
        </form>
      </AddNewModal>
    </>
  );
}
