"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { notify } from "@/lib/notify";
import { updateBookSection } from "../actions";

// v1.94.0: title + subtitle edit for an existing section. Slug stays
// stable (URLs are public-shareable + couple's muscle memory survives
// a rename). Title field was previously edit-locked — couples had to
// re-create + reorder if they wanted to fix a typo. Now both edit
// inline via this modal, surfaced as an "Edit details" button next to
// "+ New card" in the /book/[slug] header.
export function EditSectionToggle({
  id,
  initialTitle,
  initialSubtitle,
}: {
  id: string;
  initialTitle: string;
  initialSubtitle: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit details
      </Button>
      <AddNewModal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit section details"
        width="md"
      >
        <form
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const res = await updateBookSection(id, fd);
              if (res.ok) {
                notify("success", "Section updated");
                setOpen(false);
              } else {
                setError(res.error);
              }
            });
          }}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Title
              </label>
              <Input
                name="title"
                defaultValue={initialTitle}
                required
                autoFocus
                maxLength={120}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Subtitle{" "}
                <span className="font-normal text-ink-tertiary/70 normal-case">
                  — optional
                </span>
              </label>
              <Input
                name="subtitle"
                defaultValue={initialSubtitle ?? ""}
                maxLength={240}
                placeholder="e.g. Package, shot list, locations, day-of contact"
              />
              <p className="text-[11px] text-ink-tertiary mt-1">
                Shows under the section title on the Wedding Book overview
                and at the top of this page.
              </p>
            </div>
          </div>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          <div className="flex gap-2 justify-end mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </AddNewModal>
    </>
  );
}
