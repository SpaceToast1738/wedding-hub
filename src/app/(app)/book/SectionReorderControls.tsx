"use client";

// v1.87.0: small couple-only reorder buttons for a Wedding Book
// section card on /book.
//
// Design-pass fix: these used to float absolutely over the card's
// top-right corner — right on top of the "→" affordance that invites
// a tap — so a near-miss on the tiny ▲/▼ glyphs landed on the parent
// Link and navigated away instead of reordering. Section cards on the
// index are `<Link>` elements; nesting an interactive button inside a
// Link is invalid HTML, so this now renders as its own row ABOVE the
// Link (the caller stacks them in a flex-col) instead of layering on
// top of it — there's no shared hit-area left to mis-tap into.
// Buttons use the Button primitive (40px mobile touch floor) with
// visible text labels rather than bare glyphs.
//
// Calls `reorderBookSection(id, delta)` and surfaces error toasts via
// the standard notify helper. The page revalidates `/book` so the
// new order renders on the next paint.

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { reorderBookSection } from "./actions";

export function SectionReorderControls({
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
      const res = await reorderBookSection(id, delta);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => move(-1)}
        disabled={pending || isFirst}
        aria-label={`Move "${title}" up`}
      >
        ↑ Move up
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => move(1)}
        disabled={pending || isLast}
        aria-label={`Move "${title}" down`}
      >
        ↓ Move down
      </Button>
    </div>
  );
}
