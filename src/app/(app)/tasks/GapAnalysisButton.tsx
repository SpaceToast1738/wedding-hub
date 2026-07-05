"use client";

// v2.3.0: "Gap analysis" affordance in the /tasks header. One click
// diffs the couple's task list + supplier categories against a
// curated UK-wedding checklist, emits a batch of task.create
// proposals into the review queue on /ai.
//
// v2.5.0 (mod #8): dropped the undismissable, timeout-less absolute-
// positioned result popover (hardcoded emerald/rose Tailwind classes,
// no escape hatch) in favour of the shared toast bus — same pattern as
// TaskDrawer's "Break down" button (see TaskDrawer.tsx's onBreakdown).
// Now lives inside page.tsx's Tools menu rather than as a standalone
// header button, so the default className renders it as a menu item;
// callers embedding it elsewhere can override via `className`.

import { useTransition } from "react";
import { notify } from "@/lib/notify";
import { runGapAnalysis } from "@/app/(app)/ai/actions";

const DEFAULT_CLASS =
  "block w-full text-left text-sm px-2.5 py-2 min-h-[40px] sm:min-h-0 rounded-sm text-ink-secondary hover:bg-canvas disabled:opacity-60";

export function GapAnalysisButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const res = await runGapAnalysis();
        if (res.ok) {
          notify(
            "success",
            `Drafted ${res.count} gap${res.count === 1 ? "" : "s"} in ${res.categories.join(", ")} — review on /ai`,
          );
        } else {
          notify("error", res.error);
        }
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Gap analysis failed");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      role="menuitem"
      className={className ?? DEFAULT_CLASS}
    >
      {pending ? "Analysing…" : "🔍 Gap analysis"}
    </button>
  );
}
