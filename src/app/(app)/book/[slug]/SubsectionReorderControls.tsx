"use client";

// v1.87.0: per-card ▲/▼ reorder buttons on a section page. Sits in a
// small action-row that anchors right above each subsection card.
// Couple-only — parent page gates on `editable`. Mirrors the v1.85.0
// budget-category reorder pattern.
//
// Design-pass fix: this used to be two bare-glyph ▲/▼ buttons
// (~20px hit areas, explained only by hover tooltips) sitting next to
// SubsectionWidthToggle's own bare-glyph ⇆ button — three cryptic
// icon-only controls in a row. Consolidated into one clearly-labeled
// "Layout" menu (Move up / Move down / Full width — Single column)
// behind a single properly-sized trigger (the Button primitive's 40px
// mobile touch floor). SubsectionWidthToggle.tsx now just re-exports
// this component — see that file's comment.

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { reorderBookSubsection, setBookSubsectionWide } from "../actions";

export function SubsectionCardMenu({
  id,
  title,
  isFirst,
  isLast,
  wide,
  showReorder,
}: {
  id: string;
  title: string;
  isFirst: boolean;
  isLast: boolean;
  wide: boolean;
  /** Reorder only makes sense with 2+ cards on the section — the
   *  caller passes `section.subsections.length > 1`. */
  showReorder: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function move(delta: -1 | 1) {
    setOpen(false);
    startTransition(async () => {
      const res = await reorderBookSubsection(id, delta);
      if (!res.ok) notify("error", res.error);
    });
  }

  function toggleWidth() {
    setOpen(false);
    startTransition(async () => {
      const res = await setBookSubsectionWide(id, !wide);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Layout options for "${title}"`}
      >
        ⇅ Layout
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 z-20 w-48 rounded-md border border-border-soft bg-surface shadow-lg py-1 text-xs"
        >
          {showReorder && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => move(-1)}
                disabled={pending || isFirst}
                className="w-full text-left px-3 py-2 text-ink-secondary hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Move up
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => move(1)}
                disabled={pending || isLast}
                className="w-full text-left px-3 py-2 text-ink-secondary hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Move down
              </button>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={toggleWidth}
            disabled={pending}
            className="w-full text-left px-3 py-2 text-ink-secondary hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {wide ? "Single column" : "Full width"}
          </button>
        </div>
      )}
    </div>
  );
}
