"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { addSongRequestForGuest } from "../actions";

// B9 (v1.13.0): inline song-request add on guest detail.
//
// Two-part component because the trigger lives in the section header
// (alongside the count + "Manage on Songs →" link) but the form needs
// to expand full-width below the header. We expose `<Trigger />` and
// `<Form />` as separate sub-exports that share state via a tiny
// module-scoped store — overkill, so we just use a controlled prop
// pattern instead.
//
// The parent renders both children inside the same section; they
// communicate via React state local to the page render.

export function AddSongRequestInline({ guestId }: { guestId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] text-info hover:underline"
        >
          + Add request
        </button>
      )}
      {open && <Form guestId={guestId} onClose={() => setOpen(false)} />}
    </>
  );
}

function Form({ guestId, onClose }: { guestId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("guestId", guestId);
    fd.set("title", trimmed);
    if (artist.trim()) fd.set("artist", artist.trim());
    startTransition(async () => {
      try {
        await addSongRequestForGuest(fd);
        setTitle("");
        setArtist("");
        onClose();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't add request");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="text"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Song title"
        required
        autoFocus
        disabled={pending}
        className="text-xs bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 outline-none focus:border-moss-500 disabled:opacity-50 w-[140px]"
      />
      <input
        type="text"
        name="artist"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Artist"
        disabled={pending}
        className="text-xs bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 outline-none focus:border-moss-500 disabled:opacity-50 w-[100px]"
      />
      <Button type="button" variant="primary" size="sm" onClick={submit} disabled={pending || !title.trim()}>
        {pending ? "…" : "Add"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
        ×
      </Button>
    </span>
  );
}
