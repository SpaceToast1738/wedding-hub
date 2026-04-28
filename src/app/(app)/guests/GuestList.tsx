"use client";

import { useMemo, useState } from "react";
import { HouseholdBlock } from "./HouseholdBlock";

// Loose `Household` type — matches what /guests/page.tsx hands us.
// Defined here rather than imported because the page-level shape is
// inferred from a Prisma query and re-typing it would be churn.
type GuestForFilter = {
  id: string;
  firstName: string;
  lastName: string;
};

type Household = {
  id: string;
  name: string;
  guests: GuestForFilter[];
};

// B8 (v1.12.0): client wrapper around the household list with a sticky
// search input. Filters households whose name OR any guest's first or
// last name matches the query. Case-insensitive substring match —
// fuzzy matching is overkill for ~50 households.
//
// Why client-side: the full guest list is already shipped in the SSR
// page payload; doing the filter on the server would mean a round-trip
// per keystroke. ~50 households × ~5 guests = 250 string comparisons,
// which runs in <1ms on every keystroke.
export function GuestList<T extends Household>({
  households,
  canEdit,
}: {
  households: T[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!trimmed) return households;
    return households.filter((h) => {
      if (h.name.toLowerCase().includes(trimmed)) return true;
      return h.guests.some(
        (g) =>
          g.firstName.toLowerCase().includes(trimmed) ||
          g.lastName.toLowerCase().includes(trimmed) ||
          `${g.firstName} ${g.lastName}`.toLowerCase().includes(trimmed),
      );
    });
  }, [households, trimmed]);

  return (
    <>
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-soft -mx-6 px-6 py-3 mb-4">
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
              {filtered.length}/{households.length}
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
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-tertiary text-center py-12">
          {trimmed ? `No households or guests match "${query}".` : "No households yet."}
        </p>
      ) : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {filtered.map((h) => <HouseholdBlock key={h.id} household={h as any} canEdit={canEdit} />)}
        </div>
      )}
    </>
  );
}
