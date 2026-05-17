"use client";

// v1.95.0: per-card width toggle on the section page. Sits in the
// same action row as SubsectionReorderControls, flips the card
// between single-column (default) and 2-column span on the /book/[slug]
// grid. Couple-permitted edit gate — layout is cosmetic so any
// book-editor can adjust.

import { useTransition } from "react";
import { notify } from "@/lib/notify";
import { setBookSubsectionWide } from "../actions";

export function SubsectionWidthToggle({
  id,
  title,
  wide,
}: {
  id: string;
  title: string;
  wide: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await setBookSubsectionWide(id, !wide);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={
        wide
          ? `Make "${title}" single column`
          : `Make "${title}" full width`
      }
      title={wide ? "Make single column" : "Make full width"}
      className="px-1.5 py-0.5 text-xs rounded-sm text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {wide ? "⇤⇥" : "⇆"}
    </button>
  );
}
