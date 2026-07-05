"use client";

// v2.3.0: "Gap analysis" affordance in the /tasks header. One click
// diffs the couple's task list + supplier categories against a
// curated UK-wedding checklist, emits a batch of task.create
// proposals into the review queue on /ai.

import Link from "next/link";
import { useState, useTransition } from "react";
import { runGapAnalysis } from "@/app/(app)/ai/actions";

export function GapAnalysisButton() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "success"; count: number; categories: string[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function run() {
    setState({ kind: "idle" });
    startTransition(async () => {
      const res = await runGapAnalysis();
      if (res.ok) setState({ kind: "success", count: res.count, categories: res.categories });
      else setState({ kind: "error", message: res.error });
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700 disabled:opacity-60"
      >
        {pending ? "Analysing…" : "🔍 Gap analysis"}
      </button>
      {state.kind === "success" && (
        <div className="absolute right-0 mt-1 z-30 w-64 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 shadow-md">
          ✓ Found {state.count} gap{state.count === 1 ? "" : "s"} in {state.categories.join(", ")}.{" "}
          <Link href="/ai" className="underline font-medium">
            Review on /ai →
          </Link>
        </div>
      )}
      {state.kind === "error" && (
        <div className="absolute right-0 mt-1 z-30 w-64 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900 shadow-md">
          ✗ {state.message}
        </div>
      )}
    </div>
  );
}
