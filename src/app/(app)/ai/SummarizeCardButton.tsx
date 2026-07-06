"use client";

// v2.1.0 phase 3: Summarize button that hangs off TEXT-card renders.
// Uncoupled from SubsectionEditor so we don't have to touch that file
// for every AI addition — CardRouter renders us next to the editor
// when both bodyHtml/body are non-empty.

import Link from "next/link";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { summarizeBookCard } from "./actions";

export function SummarizeCardButton({
  subsectionId,
  hasContent,
}: {
  subsectionId: string;
  hasContent: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "success"; summary: string; proposalId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  if (!hasContent) return null;

  function run() {
    setState({ kind: "idle" });
    startTransition(async () => {
      const res = await summarizeBookCard(subsectionId);
      if (res.ok) {
        setState({ kind: "success", summary: res.summary, proposalId: res.proposalId });
      } else {
        setState({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-xs rounded-md border border-border-soft bg-surface text-ink-secondary px-2 py-1 hover:bg-surface-hover disabled:opacity-60"
      >
        {pending ? (
          "Summarizing…"
        ) : (
          <span className="inline-flex items-center gap-1">
            <Sparkles aria-hidden className="w-3 h-3" /> Summarize card
          </span>
        )}
      </button>
      {state.kind === "success" && (
        <div className="mt-2 text-xs rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 p-2">
          <div className="font-medium mb-1">Draft summary ready</div>
          <div className="whitespace-pre-wrap italic mb-2">{state.summary}</div>
          <Link href="/ai" className="underline">
            Review + apply on /ai →
          </Link>
        </div>
      )}
      {state.kind === "error" && (
        <div className="mt-2 text-xs text-rose-700">✗ {state.message}</div>
      )}
    </div>
  );
}
