"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptySearch, EmptyState } from "@/components/ui/Illustrations";
import { HouseholdBlock } from "./HouseholdBlock";

// v1.17.0: filter + sort + default-preference state lives on the client.
// The page query already pulls full household + guest data; filters and
// sorts run in-memory across <50 households so a round-trip per change
// would be wasteful.
//
// Default preference is persisted to localStorage so the user's chosen
// filter/sort survives across sessions and devices (the latter via the
// browser sync mechanism, not the DB — this is per-device by design).

type GuestForFilter = {
  id: string;
  firstName: string;
  lastName: string;
  rsvp?: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  side?: "BRIDE" | "GROOM" | "BOTH";
  isChild?: boolean;
  dietary?: string[];
};

type Household = {
  id: string;
  name: string;
  side?: "BRIDE" | "GROOM" | "BOTH";
  guests: GuestForFilter[];
};

// ── Filter + sort definitions ───────────────────────────────────────────────

type RsvpFilter = "all" | "attending" | "pending" | "declined" | "maybe";
type SideFilter = "all" | "bride" | "groom" | "both";
type ExtraFilter = "all" | "children" | "dietary";
type SortKey =
  | "name-asc"
  | "name-desc"
  | "side"
  | "size-desc"
  | "size-asc";

const SORT_LABELS: Record<SortKey, string> = {
  "name-asc": "Household A → Z",
  "name-desc": "Household Z → A",
  side: "Side (bride / groom / both)",
  "size-desc": "Largest household first",
  "size-asc": "Smallest household first",
};

const RSVP_LABELS: Record<RsvpFilter, string> = {
  all: "All RSVPs",
  attending: "Attending",
  pending: "Pending",
  declined: "Declined",
  maybe: "Maybe",
};

const SIDE_LABELS: Record<SideFilter, string> = {
  all: "All sides",
  bride: "Bride only",
  groom: "Groom only",
  both: "Both only",
};

const EXTRA_LABELS: Record<ExtraFilter, string> = {
  all: "All guests",
  children: "Households with children",
  dietary: "Households with dietary needs",
};

type ViewState = {
  rsvp: RsvpFilter;
  side: SideFilter;
  extra: ExtraFilter;
  sort: SortKey;
};

const DEFAULT_VIEW: ViewState = {
  rsvp: "all",
  side: "all",
  extra: "all",
  sort: "name-asc",
};

// localStorage keys. Two: one for "current state" (last chosen, restored on
// every navigation) and one for "user's default" (the explicit "save as
// default" pin). When `current` is missing on first load, we fall back to
// `default`; when `default` is also missing, we fall back to DEFAULT_VIEW.
const CURRENT_KEY = "wh_guests_view_current";
const DEFAULT_KEY = "wh_guests_view_default";

function readView(key: string): ViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate every field — if anything's wrong, drop the whole map and
    // fall back to defaults rather than rendering garbage.
    if (!parsed || typeof parsed !== "object") return null;
    if (!(parsed.rsvp in RSVP_LABELS)) return null;
    if (!(parsed.side in SIDE_LABELS)) return null;
    if (!(parsed.extra in EXTRA_LABELS)) return null;
    if (!(parsed.sort in SORT_LABELS)) return null;
    return parsed as ViewState;
  } catch {
    return null;
  }
}

function writeView(key: string, view: ViewState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(view));
  } catch {
    // ignore — non-critical
  }
}

function viewsEqual(a: ViewState, b: ViewState): boolean {
  return a.rsvp === b.rsvp && a.side === b.side && a.extra === b.extra && a.sort === b.sort;
}

// ── Filter / sort logic ─────────────────────────────────────────────────────
//
// A household passes the filter when AT LEAST ONE of its guests matches.
// This is the only sensible interpretation: hiding a household because
// half its members declined would lose the host. The "extra" filter is
// the same — a household with one child guest qualifies for "children".

function filterHouseholds<T extends Household>(
  households: T[],
  view: ViewState,
  query: string,
): T[] {
  const trimmed = query.trim().toLowerCase();
  return households.filter((h) => {
    if (trimmed) {
      const matchesText =
        h.name.toLowerCase().includes(trimmed) ||
        h.guests.some(
          (g) =>
            g.firstName.toLowerCase().includes(trimmed) ||
            g.lastName.toLowerCase().includes(trimmed) ||
            `${g.firstName} ${g.lastName}`.toLowerCase().includes(trimmed),
        );
      if (!matchesText) return false;
    }
    if (view.rsvp !== "all") {
      const target = view.rsvp.toUpperCase();
      if (!h.guests.some((g) => g.rsvp === target)) return false;
    }
    if (view.side !== "all") {
      const target = view.side.toUpperCase();
      const householdMatches = h.side === target;
      const anyGuestMatches = h.guests.some((g) => g.side === target);
      if (!householdMatches && !anyGuestMatches) return false;
    }
    if (view.extra === "children") {
      if (!h.guests.some((g) => g.isChild)) return false;
    }
    if (view.extra === "dietary") {
      if (!h.guests.some((g) => g.dietary && g.dietary.length > 0)) return false;
    }
    return true;
  });
}

function sortHouseholds<T extends Household>(households: T[], sort: SortKey): T[] {
  const copy = [...households];
  switch (sort) {
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "side":
      return copy.sort((a, b) => {
        const aSide = a.side ?? "BOTH";
        const bSide = b.side ?? "BOTH";
        if (aSide !== bSide) return aSide.localeCompare(bSide);
        return a.name.localeCompare(b.name);
      });
    case "size-desc":
      return copy.sort((a, b) => b.guests.length - a.guests.length || a.name.localeCompare(b.name));
    case "size-asc":
      return copy.sort((a, b) => a.guests.length - b.guests.length || a.name.localeCompare(b.name));
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function GuestList<T extends Household>({
  households,
  canEdit,
}: {
  households: T[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [savedDefault, setSavedDefault] = useState<ViewState>(DEFAULT_VIEW);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount. SSR renders DEFAULT_VIEW so the
  // markup is stable; the first client render swaps in the persisted
  // values. `hydrated` flag stops the "Save as default" toggle from
  // flashing during the hydration tick.
  useEffect(() => {
    const fallback = readView(DEFAULT_KEY) ?? DEFAULT_VIEW;
    const current = readView(CURRENT_KEY) ?? fallback;
    setSavedDefault(fallback);
    setView(current);
    setHydrated(true);
  }, []);

  // Persist the current view on change, after hydration has happened so
  // we don't immediately overwrite stored state with DEFAULT_VIEW.
  useEffect(() => {
    if (hydrated) writeView(CURRENT_KEY, view);
  }, [view, hydrated]);

  const filtered = useMemo(() => filterHouseholds(households, view, query), [households, view, query]);
  const sorted = useMemo(() => sortHouseholds(filtered, view.sort), [filtered, view.sort]);

  const trimmed = query.trim();
  const isDefault = viewsEqual(view, savedDefault);
  const matchesEmpty = viewsEqual(view, DEFAULT_VIEW);

  function reset() {
    setView(DEFAULT_VIEW);
    setQuery("");
  }

  function saveAsDefault() {
    writeView(DEFAULT_KEY, view);
    setSavedDefault(view);
  }

  function restoreSaved() {
    setView(savedDefault);
  }

  return (
    <>
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-soft -mx-6 px-6 py-3 mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search households or guests…"
            aria-label="Search guests"
            className="flex-1 text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-3 py-1.5 outline-none focus:border-moss-500"
          />
          {trimmed && (
            <span className="text-[11px] text-ink-tertiary tabular-nums whitespace-nowrap">
              {sorted.length}/{households.length}
            </span>
          )}
          {trimmed && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-ink-tertiary hover:text-ink-primary px-1.5"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <FilterSelect
            label="Sort"
            value={view.sort}
            options={SORT_LABELS}
            onChange={(v) => setView({ ...view, sort: v as SortKey })}
          />
          <FilterSelect
            label="RSVP"
            value={view.rsvp}
            options={RSVP_LABELS}
            onChange={(v) => setView({ ...view, rsvp: v as RsvpFilter })}
          />
          <FilterSelect
            label="Side"
            value={view.side}
            options={SIDE_LABELS}
            onChange={(v) => setView({ ...view, side: v as SideFilter })}
          />
          <FilterSelect
            label="Show"
            value={view.extra}
            options={EXTRA_LABELS}
            onChange={(v) => setView({ ...view, extra: v as ExtraFilter })}
          />

          {hydrated && !isDefault && (
            <button
              type="button"
              onClick={saveAsDefault}
              className="text-info hover:underline whitespace-nowrap"
              title="Save the current filter/sort as your default for next time"
            >
              Save as default
            </button>
          )}
          {hydrated && isDefault && !matchesEmpty && (
            <span className="text-ink-tertiary whitespace-nowrap" title="This matches your saved default">
              ✓ default
            </span>
          )}
          {!matchesEmpty && (
            <button
              type="button"
              onClick={savedDefault === DEFAULT_VIEW ? reset : restoreSaved}
              className="text-ink-tertiary hover:text-ink-primary whitespace-nowrap"
            >
              {savedDefault === DEFAULT_VIEW ? "Reset" : "Reset to default"}
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        trimmed || !matchesEmpty ? (
          <EmptyState
            illustration={EmptySearch}
            title={trimmed ? `No matches for "${query}"` : "No households match your filters"}
            body="Try widening the filter or clearing the search."
          />
        ) : (
          <p className="text-sm text-ink-tertiary text-center py-12">No households yet.</p>
        )
      ) : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {sorted.map((h) => <HouseholdBlock key={h.id} household={h as any} canEdit={canEdit} />)}
        </div>
      )}
    </>
  );
}

function FilterSelect<K extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: K;
  options: Record<K, string>;
  onChange: (v: K) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-ink-tertiary uppercase font-bold tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as K)}
        className="text-xs bg-surface text-ink-primary border border-border-soft rounded-sm px-1.5 py-1 outline-none focus:border-moss-500"
      >
        {(Object.keys(options) as K[]).map((k) => (
          <option key={k} value={k}>{options[k]}</option>
        ))}
      </select>
    </label>
  );
}
