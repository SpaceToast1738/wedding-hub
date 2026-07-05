"use client";

import { useEffect, useRef, useState } from "react";

// v1.30.5: combined multi-select picker for Wedding Book sections + Nav
// tags. Renders a chip row + a click-to-open dropdown with two grouped
// checkbox sections. Emits one hidden <input name="topicKeys"> per
// selected entry, prefixed `bookSection:` or `navTag:` so the server
// action can split by source.
//
// v1.51.0: added a third group — Wedding Book **cards** (subsections).
// `bookSubsection:<id>` keys flow through the same `topicKeys` payload
// and end up on the parallel `Task.bookSubsections` m2m, which drives
// the inline tasks panel rendered below each card on /book/[slug].
//
// v1.61.0 (XL1): added a fourth group — Guest groups. `guestGroup:<id>`
// keys flow through the same payload and land on the new
// `Task.guestGroups` m2m. Tasks tagged with a GuestGroup surface on
// every member's /guests/[id] page (read-time query — no auto-sync,
// per the v1.30.5 cross-module-wiring rule).
//
// In read-only mode (canEdit=false) the dropdown trigger is omitted —
// just the chip row renders.

export type BookSectionOpt = {
  id: string;
  title: string;
  /** v1.58.0 (XL7): slug for chip deep-link → `/book/<slug>`. */
  slug?: string;
};
export type BookSubsectionOpt = {
  id: string;
  title: string;
  /** Parent section title; rendered as a prefix so two cards with
   *  the same name on different pages stay unambiguous. */
  sectionTitle: string;
  /** v1.58.0 (XL7): slugs for chip deep-link → `/book/<sectionSlug>#<slug>`. */
  slug?: string;
  sectionSlug?: string;
};
export type NavTagOpt = { id: string; name: string; route: string | null };
/** v1.61.0 (XL1): guest group option. Colour rendered as a swatch in
 *  the dropdown so the couple can pick visually (matches the seating
 *  canvas treatment). Member count helps disambiguate near-empty
 *  groups. No `href` for the chip — there's no per-group page yet. */
export type GuestGroupOpt = {
  id: string;
  name: string;
  colour: string | null;
  memberCount: number;
};

type Props = {
  bookSections: BookSectionOpt[];
  bookSubsections?: BookSubsectionOpt[];
  navTags: NavTagOpt[];
  guestGroups?: GuestGroupOpt[];
  initialBookSectionIds: string[];
  initialBookSubsectionIds?: string[];
  initialNavTagIds: string[];
  initialGuestGroupIds?: string[];
  canEdit?: boolean;
  // Optional callback invoked when the selection changes — drawer uses
  // it for dirty-check and to suppress the form-submit pattern when
  // it's saving via FormData.set instead of <form action>.
  onChange?: (next: {
    bookSectionIds: string[];
    bookSubsectionIds: string[];
    navTagIds: string[];
    guestGroupIds: string[];
  }) => void;
};

export function TopicPicker({
  bookSections,
  bookSubsections = [],
  navTags,
  guestGroups = [],
  initialBookSectionIds,
  initialBookSubsectionIds = [],
  initialNavTagIds,
  initialGuestGroupIds = [],
  canEdit = true,
  onChange,
}: Props) {
  const [bookSectionIds, setBookSectionIds] = useState<string[]>(initialBookSectionIds);
  const [bookSubsectionIds, setBookSubsectionIds] = useState<string[]>(initialBookSubsectionIds);
  const [navTagIds, setNavTagIds] = useState<string[]>(initialNavTagIds);
  const [guestGroupIds, setGuestGroupIds] = useState<string[]>(initialGuestGroupIds);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Notify parent on every change.
  useEffect(() => {
    onChange?.({ bookSectionIds, bookSubsectionIds, navTagIds, guestGroupIds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSectionIds.join(","), bookSubsectionIds.join(","), navTagIds.join(","), guestGroupIds.join(",")]);

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
  function toggleBookSubsection(id: string) {
    setBookSubsectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function toggleNavTag(id: string) {
    setNavTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function toggleGuestGroup(id: string) {
    setGuestGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const totalSelected = bookSectionIds.length + bookSubsectionIds.length + navTagIds.length + guestGroupIds.length;
  const sectionLookup = new Map(bookSections.map((s) => [s.id, s]));
  const subsectionLookup = new Map(bookSubsections.map((s) => [s.id, s]));
  const tagLookup = new Map(navTags.map((t) => [t.id, t]));
  const guestGroupLookup = new Map(guestGroups.map((g) => [g.id, g]));

  // v1.58.0 (XL7): each chip carries an optional `href` for chip-
  // label deep-link. Sections → /book/<slug>; subsections →
  // /book/<sectionSlug>#<slug>; nav tags → t.route. The × stays as
  // a separate button so removal still works inline.
  const selectedChips: {
    key: string;
    label: string;
    kind: "section" | "subsection" | "tag" | "guestGroup";
    href: string | null;
    swatch?: string | null;
  }[] = [
    ...bookSectionIds.map((id) => {
      const s = sectionLookup.get(id);
      return {
        key: `bookSection:${id}`,
        label: s?.title ?? "Unknown section",
        kind: "section" as const,
        href: s?.slug ? `/book/${s.slug}` : null,
      };
    }),
    ...bookSubsectionIds.map((id) => {
      const s = subsectionLookup.get(id);
      const label = s ? `${s.sectionTitle} · ${s.title}` : "Unknown card";
      return {
        key: `bookSubsection:${id}`,
        label,
        kind: "subsection" as const,
        href: s?.sectionSlug && s.slug ? `/book/${s.sectionSlug}#${s.slug}` : null,
      };
    }),
    ...navTagIds.map((id) => {
      const t = tagLookup.get(id);
      return {
        key: `navTag:${id}`,
        label: t?.name ?? "Unknown tag",
        kind: "tag" as const,
        href: t?.route ?? null,
      };
    }),
    ...guestGroupIds.map((id) => {
      const g = guestGroupLookup.get(id);
      return {
        key: `guestGroup:${id}`,
        label: g?.name ?? "Unknown group",
        kind: "guestGroup" as const,
        // No per-group page yet — chip carries no href.
        href: null,
        swatch: g?.colour ?? null,
      };
    }),
  ];

  return (
    <div ref={rootRef} className="relative">
      {/* Hidden inputs — one per selected key. Submitted with the form.
          v1.61.1: + a `__touched__` sentinel emitted whenever the picker
          renders in editable mode, so `formData.has("topicKeys")` on
          the server returns true even when the user has cleared every
          chip. Pre-fix, an empty selection looked identical to a
          partial update that didn't include the picker — so removing
          the last chip was a silent no-op (existing relations stayed
          intact). The sentinel doesn't match any prefix in
          parseTopicKeys, so it doesn't pollute the four ID arrays. */}
      {canEdit && (
        <input type="hidden" name="topicKeys" value="__touched__" />
      )}
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
                  : c.kind === "subsection"
                    ? "bg-moss-100/60 border-moss-300 text-moss-700"
                    : c.kind === "guestGroup"
                      ? "bg-canvas border-border-strong text-ink-secondary"
                      : "bg-marigold-100/40 border-marigold-700/30 text-marigold-700",
              ].join(" ")}
            >
              {/* v1.61.0 (XL1): guest-group chips render the group's
                  colour as a swatch dot. Matches the seating canvas. */}
              {c.kind === "guestGroup" && c.swatch && (
                <span
                  aria-hidden
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: c.swatch }}
                />
              )}
              {c.href ? (
                <a
                  href={c.href}
                  className="hover:underline"
                  title={`Open ${c.label}`}
                >
                  {c.label}
                </a>
              ) : (
                c.label
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    if (c.kind === "section") toggleBookSection(c.key.slice("bookSection:".length));
                    else if (c.kind === "subsection") toggleBookSubsection(c.key.slice("bookSubsection:".length));
                    else if (c.kind === "guestGroup") toggleGuestGroup(c.key.slice("guestGroup:".length));
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
        <div className="absolute left-0 top-full mt-1 z-30 w-[min(320px,calc(100vw-2rem))] max-h-[360px] overflow-auto bg-surface border border-border-soft rounded-md shadow-lg">
          {bookSections.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-ink-tertiary border-b border-border-soft bg-canvas/30">
                Wedding Book — sections
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
          {bookSubsections.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-ink-tertiary border-b border-t border-border-soft bg-canvas/30">
                Wedding Book — cards
              </div>
              <ul>
                {bookSubsections.map((s) => {
                  const checked = bookSubsectionIds.includes(s.id);
                  return (
                    <li key={s.id}>
                      <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-canvas/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBookSubsection(s.id)}
                          className="accent-moss-500"
                        />
                        <span className="text-ink-primary truncate">{s.title}</span>
                        <span className="ml-auto text-[10px] text-ink-tertiary truncate max-w-[110px]">
                          {s.sectionTitle}
                        </span>
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
          {guestGroups.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-ink-tertiary border-b border-t border-border-soft bg-canvas/30">
                Guest groups
              </div>
              <ul>
                {guestGroups.map((g) => {
                  const checked = guestGroupIds.includes(g.id);
                  return (
                    <li key={g.id}>
                      <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-canvas/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGuestGroup(g.id)}
                          className="accent-moss-500"
                        />
                        {g.colour && (
                          <span
                            aria-hidden
                            className="inline-block w-3 h-3 rounded-full flex-shrink-0 border border-border-soft"
                            style={{ background: g.colour }}
                          />
                        )}
                        <span className="text-ink-primary truncate">{g.name}</span>
                        <span className="ml-auto text-[10px] text-ink-tertiary tabular-nums">
                          {g.memberCount}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {bookSections.length === 0 && bookSubsections.length === 0 && navTags.length === 0 && guestGroups.length === 0 && (
            <p className="px-3 py-3 text-xs text-ink-tertiary italic">
              No topics defined yet. Add nav tags or guest groups in Settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
