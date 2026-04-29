"use client";

import { useEffect, useRef, useState } from "react";

// v1.30.5: combined multi-select picker for Wedding Book sections + Nav
// tags. Renders a chip row + a click-to-open dropdown with two grouped
// checkbox sections. Emits one hidden <input name="topicKeys"> per
// selected entry, prefixed `bookSection:` or `navTag:` so the server
// action can split by source.
//
// In read-only mode (canEdit=false) the dropdown trigger is omitted —
// just the chip row renders.

export type BookSectionOpt = { id: string; title: string };
export type NavTagOpt = { id: string; name: string; route: string | null };

type Props = {
  bookSections: BookSectionOpt[];
  navTags: NavTagOpt[];
  initialBookSectionIds: string[];
  initialNavTagIds: string[];
  canEdit?: boolean;
  // Optional callback invoked when the selection changes — drawer uses
  // it for dirty-check and to suppress the form-submit pattern when
  // it's saving via FormData.set instead of <form action>.
  onChange?: (next: { bookSectionIds: string[]; navTagIds: string[] }) => void;
};

export function TopicPicker({
  bookSections,
  navTags,
  initialBookSectionIds,
  initialNavTagIds,
  canEdit = true,
  onChange,
}: Props) {
  const [bookSectionIds, setBookSectionIds] = useState<string[]>(initialBookSectionIds);
  const [navTagIds, setNavTagIds] = useState<string[]>(initialNavTagIds);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Notify parent on every change.
  useEffect(() => {
    onChange?.({ bookSectionIds, navTagIds });
    // We deliberately don't depend on `onChange` to avoid identity-
    // swap re-runs when the parent re-renders. The arrays are the
    // source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSectionIds.join(","), navTagIds.join(",")]);

  // Click-outside + Esc to close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleBookSection(id: string) {
    setBookSectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function toggleNavTag(id: string) {
    setNavTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const totalSelected = bookSectionIds.length + navTagIds.length;
  const sectionLookup = new Map(bookSections.map((s) => [s.id, s]));
  const tagLookup = new Map(navTags.map((t) => [t.id, t]));

  const selectedChips: { key: string; label: string; kind: "section" | "tag" }[] = [
    ...bookSectionIds.map((id) => {
      const s = sectionLookup.get(id);
      return { key: `bookSection:${id}`, label: s?.title ?? "Unknown section", kind: "section" as const };
    }),
    ...navTagIds.map((id) => {
      const t = tagLookup.get(id);
      return { key: `navTag:${id}`, label: t?.name ?? "Unknown tag", kind: "tag" as const };
    }),
  ];

  return (
    <div ref={rootRef} className="relative">
      {/* Hidden inputs — one per selected key. Submitted with the form. */}
      {selectedChips.map((c) => (
        <input key={c.key} type="hidden" name="topicKeys" value={c.key} />
      ))}

      {/* Trigger row: chips + (when editable) the dropdown opener. */}
      <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
        {selectedChips.length === 0 ? (
          <span className="text-xs text-ink-tertiary italic">
            {canEdit ? "No topics — click + to add" : "—"}
          </span>
        ) : (
          selectedChips.map((c) => (
            <span
              key={c.key}
              className={[
                "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border",
                c.kind === "section"
                  ? "bg-moss-50 border-moss-300 text-moss-700"
                  : "bg-marigold-100/40 border-marigold-700/30 text-marigold-700",
              ].join(" ")}
            >
              {c.label}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    if (c.kind === "section") toggleBookSection(c.key.slice("bookSection:".length));
                    else toggleNavTag(c.key.slice("navTag:".length));
                  }}
                  className="text-ink-tertiary hover:text-ink-primary leading-none"
                  aria-label={`Remove ${c.label}`}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] px-1.5 py-0.5 rounded-md border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
            aria-expanded={open}
          >
            + {totalSelected === 0 ? "Add topic" : "Edit"}
          </button>
        )}
      </div>

      {/* Dropdown panel. Absolute-positioned below the trigger. */}
      {open && canEdit && (
        <div className="absolute left-0 top-full mt-1 z-30 w-[280px] max-h-[320px] overflow-auto bg-surface border border-border-soft rounded-md shadow-lg">
          {bookSections.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-ink-tertiary border-b border-border-soft bg-canvas/30">
                Wedding Book
              </div>
              <ul>
                {bookSections.map((s) => {
                  const checked = bookSectionIds.includes(s.id);
                  return (
                    <li key={s.id}>
                      <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-canvas/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBookSection(s.id)}
                          className="accent-moss-500"
                        />
                        <span className="text-ink-primary">{s.title}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {navTags.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-ink-tertiary border-b border-t border-border-soft bg-canvas/30">
                Nav tags
              </div>
              <ul>
                {navTags.map((t) => {
                  const checked = navTagIds.includes(t.id);
                  return (
                    <li key={t.id}>
                      <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-canvas/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleNavTag(t.id)}
                          className="accent-moss-500"
                        />
                        <span className="text-ink-primary">{t.name}</span>
                        {t.route && (
                          <span className="ml-auto text-[10px] text-ink-tertiary font-mono truncate max-w-[80px]">
                            {t.route}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {bookSections.length === 0 && navTags.length === 0 && (
            <p className="px-3 py-3 text-xs text-ink-tertiary italic">
              No topics defined yet. Add nav tags in Settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
