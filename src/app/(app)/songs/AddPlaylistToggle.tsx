"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { createPlaylist } from "./actions";

const CATEGORIES = [
  { value: "MUST_PLAY", label: "Must play" },
  { value: "FIRST_DANCE", label: "First dance" },
  { value: "CEREMONY", label: "Ceremony" },
  { value: "DO_NOT_PLAY", label: "Do not play" },
  { value: "BRIDAL_PREP", label: "Bridal prep" },
  { value: "DRINKS_RECEPTION", label: "Drinks reception" },
  { value: "WEDDING_BREAKFAST", label: "Wedding breakfast" },
];

// v1.56.0: shared AddNewModal popout — was inline-expand previously.
export function AddPlaylistToggle() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
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
