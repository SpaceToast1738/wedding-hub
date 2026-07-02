"use client";

// v2.1.0 phase 5: "✨ Suggest due dates" affordance in the /tasks
// header. One click reads every open TASK-typed row with a null
// dueDate, asks the deep tier for realistic dates, emits a batch of
// task.update proposals into the review queue on /ai.

import Link from "next/link";
import { useState, useTransition } from "react";
import { suggestDueDates } from "@/app/(app)/ai/actions";

export function SuggestDueDatesButton() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "success"; count: number; skipped: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function run() {
    setState({ kind: "idle" });
    startTransition(async () => {
      const res = await suggestDueDates();
      if (res.ok) setState({ kind: "success", count: res.count, skipped: res.skipped });
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
        {pending ? "Thinking…" : "✨ Suggest due dates"}
      </button>
      {state.kind === "success" && (
        <div className="absolute right-0 mt-1 z-30 w-64 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 shadow-md">
          ✓ Drafted {state.count} due-date proposal{state.count === 1 ? "" : "s"}
          {state.skipped > 0 && ` (${state.skipped} skipped as invalid)`}.{" "}
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
