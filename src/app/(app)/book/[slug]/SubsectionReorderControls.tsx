"use client";

// v1.87.0: per-card ▲/▼ reorder buttons on a section page. Sits in a
// small action-row that anchors right above each subsection card.
// Couple-only — parent page gates on `editable`. Mirrors the v1.85.0
// budget-category reorder pattern.

import { useTransition } from "react";
import { notify } from "@/lib/notify";
import { reorderBookSubsection } from "../actions";

export function SubsectionReorderControls({
  id,
  title,
  isFirst,
  isLast,
}: {
  id: string;
  title: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function move(delta: -1 | 1) {
    startTransition(async () => {
      const res = await reorderBookSubsection(id, delta);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-0.5 -mb-2">
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={pending || isFirst}
        aria-label={`Move "${title}" up`}
        title="Move page up"
        className="px-1.5 py-0.5 text-xs rounded-sm text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={pending || isLast}
        aria-label={`Move "${title}" down`}
        title="Move page down"
        className="px-1.5 py-0.5 text-xs rounded-sm text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ▼
      </button>
    </div>
  );
}
