"use client";

// v1.21.0: client wrapper around the supplier list with a sticky
// search input + category grouping. Mirrors the GuestList sticky-
// search pattern from B8 (v1.12.0). Filters by name + category +
// status text match; the existing categorised layout still groups
// the visible matches.

import { useMemo, useState } from "react";
import type { SupplierStatus } from "@prisma/client";
import { SupplierCard } from "./SupplierCard";

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
  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!trimmed) return suppliers;
    return suppliers.filter((s) => {
      const hay = `${s.name} ${s.category} ${s.status} ${s.notes ?? ""}`.toLowerCase();
      return hay.includes(trimmed);
    });
  }, [suppliers, trimmed]);

  const byCategory = useMemo(() => {
    const m = new Map<string, Supplier[]>();
    for (const s of filtered) {
      const list = m.get(s.category) ?? [];
      list.push(s);
      m.set(s.category, list);
    }
    return m;
  }, [filtered]);

  return (
    <>
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-soft -mx-6 px-6 py-3 mb-4">
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
            <span className="text-[11px] text-ink-tertiary tabular-nums whitespace-nowrap">
              {filtered.length}/{suppliers.length}
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
          {trimmed ? `No suppliers match "${query}".` : "No suppliers yet."}
        </p>
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
