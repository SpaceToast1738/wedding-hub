"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { BOOK_CARD_KIND_META, BOOK_CARD_KINDS, type BookCardKind } from "@/lib/book-cards";
import { slugify } from "@/lib/slugify";
import { createBookSubsection } from "../actions";

// v1.26.0: kind picker. Pre-fix this was a "New page" form that
// always created a TEXT-shaped subsection. Now the user picks a card
// kind first (Text / Field / Recipe / Shot list / Outfit) — the
// chosen kind seeds the matching per-kind data row in the action.
//
// Pill-row picker for 5 kinds reads cleanly. If we ever cross 6+
// types, switch to a modal with icons + descriptions.

export function AddSubsectionToggle({
  sectionId,
}: {
  sectionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<BookCardKind>("TEXT");
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // v1.94.2: live anchor preview replaces the manual slug input.
  const previewSlug = slugify(title) || "page";

  // v1.56.0: shared AddNewModal popout.
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New card
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title="New card" width="md">
    <form
      action={(fd) => {
        setError(null);
        fd.set("sectionId", sectionId);
        fd.set("kind", kind);
        startTransition(async () => {
          try {
            await createBookSubsection(fd);
            setOpen(false);
            setKind("TEXT");
            setTitle("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
      className="space-y-3"
    >
      <div>
        {/* Design-pass fix: true 10px uppercase chrome labels move to
            ink-secondary for legibility (this one's a button-group
            fieldset label, not a single form control, so it can't use
            Input's built-in label prop the way "Title" below does). */}
        <label className="block text-[10px] font-bold text-ink-secondary uppercase tracking-wider mb-1.5">
          Card type
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BOOK_CARD_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={[
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                kind === k
                  ? "bg-moss-500 text-on-moss border-moss-500"
                  : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
              ].join(" ")}
              title={BOOK_CARD_KIND_META[k].description}
            >
              {BOOK_CARD_KIND_META[k].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-tertiary mt-1.5 italic">
          {BOOK_CARD_KIND_META[kind].description}
        </p>
      </div>
      <div>
        {/* Design-pass fix: swapped the unassociated manual <label>
            for Input's built-in `label` prop — properly wires
            htmlFor/id (screen readers previously announced this as
            "edit text, blank") and already uses the ink-secondary
            chrome-label colour. */}
        <Input
          label="Title"
          name="title"
          required
          autoFocus
          placeholder="e.g. Cocktail menu"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        {/* v1.94.2: anchor preview — the slug fuels the "On this page"
            row's deep-links once the section has 5+ cards. */}
        <p className="text-[11px] text-ink-tertiary mt-1">
          Anchor: <code className="font-mono text-ink-secondary">#{previewSlug}</code>
        </p>
      </div>
      {/* TEXT cards still accept an initial body inline. Other kinds
          start empty — you build them up in their dedicated UI. */}
      {kind === "TEXT" && (
        <div>
          <label className="block text-[10px] font-bold text-ink-secondary uppercase tracking-wider mb-1">
            Body
          </label>
          <MentionableTextarea
            name="body"
            rows={4}
            className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
          />
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
      </AddNewModal>
    </>
  );
}
