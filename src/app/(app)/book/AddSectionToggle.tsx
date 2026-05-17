"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { slugify } from "@/lib/slugify";
import { createBookSection } from "./actions";

// v1.56.0: shared AddNewModal popout — was inline-expand previously.
// v1.94.2: slug input dropped — auto-derived from title server-side
// via slugify(). A muted "/book/<slug>" preview line updates live as
// the title is typed so the couple sees the URL it'll become.
export function AddSectionToggle() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const previewSlug = slugify(title) || "section";

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New section
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title="New section" width="md">
        <form
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              try {
                await createBookSection(fd);
                setTitle("");
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
              }
            });
          }}
        >
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Title</label>
            <Input
              name="title"
              required
              autoFocus
              placeholder="e.g. Photography"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
            {/* v1.94.2: live URL preview replaces the manual Slug input. */}
            <p className="text-[11px] text-ink-tertiary mt-1">
              URL: <code className="font-mono text-ink-secondary">/book/{previewSlug}</code>
            </p>
          </div>
          {/* v1.94.0: optional descriptive line that renders under the
              section title on the /book overview + section page header. */}
          <div className="mt-3">
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Subtitle <span className="font-normal text-ink-tertiary/70 normal-case">— optional</span>
            </label>
            <Input
              name="subtitle"
              maxLength={240}
              placeholder="e.g. Package, shot list, locations, day-of contact"
            />
          </div>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          <div className="flex gap-2 justify-end mt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
          </div>
        </form>
      </AddNewModal>
    </>
  );
}
