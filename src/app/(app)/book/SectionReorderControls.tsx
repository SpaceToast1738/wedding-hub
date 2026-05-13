"use client";

// v1.87.0: small couple-only reorder buttons floated over a Wedding
// Book section card on /book. Section cards on the index are
// `<Link>` elements; nesting an interactive button inside a Link is
// invalid HTML, so the buttons sit absolutely-positioned over the
// card's top-right (above the Link) and `stopPropagation` to make
// sure clicks don't navigate.
//
// Calls `reorderBookSection(id, delta)` and surfaces error toasts via
// the standard notify helper. The page revalidates `/book` so the
// new order renders on the next paint.

import { useTransition } from "react";
import { notify } from "@/lib/notify";
import { reorderBookSection } from "./actions";

export function SectionReorderControls({
  id,
  isFirst,
  isLast,
}: {
  id: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function move(delta: -1 | 1) {
    startTransition(async () => {
      const res = await reorderBookSection(id, delta);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <div
      // Float in the top-right corner of the section card, just left
      // of the existing → indicator. pointer-events-auto so the
      // buttons still receive clicks despite the parent Link.
      className="absolute top-2 right-2 z-10 flex items-center gap-0.5"
      onClick={(e) => {
        // Defensive: any stray click on the wrapper shouldn't bubble
        // into the parent Link navigation.
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          move(-1);
        }}
        disabled={pending || isFirst}
        aria-label="Move section up"
        title="Move section up"
        className="px-1 py-0.5 text-xs rounded-sm bg-surface/80 hover:bg-surface text-ink-secondary disabled:opacity-30 disabled:cursor-not-allowed border border-border-soft backdrop-blur-sm"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          move(1);
        }}
        disabled={pending || isLast}
        aria-label="Move section down"
        title="Move section down"
        className="px-1 py-0.5 text-xs rounded-sm bg-surface/80 hover:bg-surface text-ink-secondary disabled:opacity-30 disabled:cursor-not-allowed border border-border-soft backdrop-blur-sm"
      >
        ▼
      </button>
    </div>
  );
}
