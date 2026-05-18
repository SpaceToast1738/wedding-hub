"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { createHousehold } from "./actions";

// v1.0.x → v1.56.0: was an inline-expand button. v1.56.0 moves to
// the shared AddNewModal wrapper for cross-page consistency — every
// "+ New X" affordance pops out instead of inline-expanding.
export function AddHouseholdToggle() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New household
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title="New household" width="sm">
        <form
          action={(fd) =>
            startTransition(async () => {
              await createHousehold(fd);
              setOpen(false);
            })
          }
          className="space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              name="name"
              required
              autoFocus
              defaultValue=""
              placeholder="e.g. The Spencer Family"
              className="sm:col-span-2"
            />
            <select
              name="side"
              defaultValue="BOTH"
              className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none"
            >
              <option value="BRIDE">Bride</option>
              <option value="GROOM">Groom</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
          <MentionableTextarea
            name="notes"
            rows={2}
            placeholder="Notes (optional)"
            className="w-full text-xs bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
          />
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Create"}
            </Button>
          </div>
        </form>
      </AddNewModal>
    </>
  );
}
