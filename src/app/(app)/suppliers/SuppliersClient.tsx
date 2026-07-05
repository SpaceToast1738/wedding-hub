"use client";

// v1.21.0: client wrapper around the supplier list with a sticky
// search input + category grouping. Mirrors the GuestList sticky-
// search pattern from B8 (v1.12.0). Filters by name + category +
// status text match; the existing categorised layout still groups
// the visible matches.

import { useMemo, useState } from "react";
import type { SupplierStatus } from "@prisma/client";
import { Tag } from "@/components/ui/Tag";
import { SupplierCard, STATUS_OPTIONS } from "./SupplierCard";
import { AddSupplierToggle } from "./AddSupplierToggle";

type Communication = { summary: string; createdAt: Date; channel: string };
type Supplier = {
  id: string;
  name: string;
  category: string;
  status: SupplierStatus;
  website: string | null;
  notes: string | null;
  amountAgreed: { toString: () => string } | null;
  communications: Communication[];
};

export function SuppliersClient({
  suppliers,
  canEdit,
  showMoney,
}: {
  suppliers: Supplier[];
  canEdit: boolean;
  /** v1.76.0: gates Agreed amount + edit-form amount input on each card. */
  showMoney: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "ALL">("ALL");
  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = suppliers;
    if (statusFilter !== "ALL") list = list.filter((s) => s.status === statusFilter);
    if (!trimmed) return list;
    return list.filter((s) => {
      const hay = `${s.name} ${s.category} ${s.status} ${s.notes ?? ""}`.toLowerCase();
      return hay.includes(trimmed);
    });
  }, [suppliers, trimmed, statusFilter]);

  const byCategory = useMemo(() => {
    const m = new Map<string, Supplier[]>();
    for (const s of filtered) {
      const list = m.get(s.category) ?? [];
      list.push(s);
      m.set(s.category, list);
    }
    // v2.5.1 (mod #7): sort cards within a group by name — status was
    // previously the primary sort key (inherited from the server
    // query), so promoting a supplier's stage reordered the cards
    // around it. Name is stable; status is a secondary tie-breaker
    // only. Then sort the groups themselves alphabetically by
    // category so the section sequence can't drift with a status
    // change either.
    for (const list of m.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name) || a.status.localeCompare(b.status));
    }
    return new Map([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [filtered]);

  const noResultsFromFilters = filtered.length === 0 && (trimmed !== "" || statusFilter !== "ALL");

  return (
    <>
      {/* v2.5.1 (mod #6): the negative-margin/padding pair now tracks
          the outer wrapper's own p-4 sm:p-6 at each breakpoint —
          previously this was hardcoded to the sm+ value (-mx-6 px-6),
          which over-subtracted on phones and let the bar bleed past
          the page's actual padding. */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-soft -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search suppliers (name, category, status, notes)…"
            aria-label="Search suppliers"
            className="flex-1 text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-3 py-1.5 outline-none focus:border-moss-500"
          />
          {trimmed && (
            <span className="text-xs text-ink-secondary tabular-nums whitespace-nowrap">
              {filtered.length}/{suppliers.length}
            </span>
          )}
          {trimmed && (
            <button
              type="button"
              onClick={() => setQuery("")}
              // v2.5.1 (mod #6): p-3.5 / -m-3.5 widens the tap target
              // to ~40px without changing the visible × glyph size —
              // the padding is invisible (no border/background) and
              // the equal negative margin stops it pushing the row's
              // layout around.
              className="text-xs text-ink-tertiary hover:text-ink-primary p-3.5 -m-3.5 rounded-sm"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {/* v2.5.1 (mod #3, cheap alternative): StatusPill renders LEAD
            and PENDING identically (same marigold classes), so
            SHORTLIST/CONTACTED/QUOTED are visually indistinguishable
            in the grid. Filter chips let users narrow to one exact
            pipeline stage without touching the shared StatusPill
            component. */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Tag label="All" active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} />
          {STATUS_OPTIONS.map((s) => (
            <Tag
              key={s}
              label={s.charAt(0) + s.slice(1).toLowerCase()}
              active={statusFilter === s}
              onClick={() => setStatusFilter((cur) => (cur === s ? "ALL" : s))}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-ink-tertiary mb-3">
            {trimmed
              ? `No suppliers match "${query}".`
              : noResultsFromFilters
                ? `No suppliers with status "${statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}".`
                : "No suppliers yet."}
          </p>
          {/* ADHD note: give the empty state something to click instead
              of a dead end — reuses the same Add flow as PageHeader's
              action button. */}
          {canEdit && !noResultsFromFilters && (
            <div className="flex justify-center">
              <AddSupplierToggle showMoney={showMoney} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byCategory.entries()).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider mb-2">
                {cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((s) => (
                  <SupplierCard key={s.id} supplier={s} canEdit={canEdit} showMoney={showMoney} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
