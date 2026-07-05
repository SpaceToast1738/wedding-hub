"use client";

// v2.5.0 (mod #9): the /tasks header used to show four peer-weight
// buttons (Gap analysis / Suggest due dates / Import CSV / New task)
// with no visual hierarchy. This collapses the three secondary actions
// behind one "Tools" trigger so "+ New task" (rendered by
// AddTaskToggle, already `variant="primary"`) reads as the obvious
// primary action in the header.
//
// Popover pattern mirrors GuestGroupsControl.tsx: click-outside +
// Escape dismiss, `role="menu"`. Each item closes the menu on click
// via the wrapping div's onClick (fires after the button's own
// onClick since the event bubbles) — the async work inside each
// button reports through notify() regardless of whether the menu is
// still open.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GapAnalysisButton } from "./GapAnalysisButton";
import { SuggestDueDatesButton } from "./SuggestDueDatesButton";

const MENU_ITEM_CLASS =
  "block w-full text-left text-sm px-2.5 py-2 min-h-[40px] sm:min-h-0 rounded-sm text-ink-secondary hover:bg-canvas disabled:opacity-60";

export function TaskToolsMenu({ canWriteAi }: { canWriteAi: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center text-xs font-medium px-2.5 py-1 min-h-[40px] sm:min-h-0 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
      >
        Tools ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 z-30 w-56 rounded-md border border-border-soft bg-surface shadow-lg p-1"
        >
          {/* v2.5.2 (review fix): role="none" removes these wrapper
              divs from the accessibility tree entirely, so each real
              button (which already carries role="menuitem" itself)
              reads as a DIRECT child of the role="menu" container
              below, matching ARIA menu authoring practice instead of
              nesting menuitem one level deeper through a plain div. */}
          {canWriteAi && (
            <div role="none" onClick={() => setOpen(false)}>
              <GapAnalysisButton className={MENU_ITEM_CLASS} />
            </div>
          )}
          {canWriteAi && (
            <div role="none" onClick={() => setOpen(false)}>
              <SuggestDueDatesButton className={MENU_ITEM_CLASS} />
            </div>
          )}
          <Link
            href="/tasks/import"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={MENU_ITEM_CLASS}
          >
            Import CSV
          </Link>
        </div>
      )}
    </div>
  );
}
