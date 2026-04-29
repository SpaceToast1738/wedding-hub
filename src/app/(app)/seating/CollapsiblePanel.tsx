"use client";

import { useEffect, useState } from "react";

// v1.23.2: shared collapsible wrapper for the seating-canvas sidebar.
// Persists its open/closed state per-key via localStorage so the
// planner's layout survives reloads. Same race-safe load/save pattern
// CountdownCard + SeatingCanvas use elsewhere — `loaded` gate so the
// save effect only fires after the initial read completes.
//
// Each panel header has a click target that toggles the disclosure
// and an arrow indicator; the body sits below an internal divider.
export function CollapsiblePanel({
  storageKey,
  title,
  defaultOpen = true,
  rightSlot,
  children,
}: {
  storageKey: string;
  title: string;
  defaultOpen?: boolean;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "true" || saved === "false") setOpen(saved === "true");
    } catch {
      // ignore — non-critical preference
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, String(open));
    } catch {
      // ignore
    }
  }, [open, loaded, storageKey]);

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-canvas/40 transition-colors rounded-md"
      >
        <span className="text-[11px] uppercase tracking-wider text-ink-secondary font-bold truncate">
          {title}
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          {rightSlot}
          <span className="text-ink-tertiary text-xs leading-none w-3 text-center">
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {open && <div className="border-t border-border-soft">{children}</div>}
    </section>
  );
}
