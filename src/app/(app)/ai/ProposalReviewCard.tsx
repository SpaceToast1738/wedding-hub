"use client";

// v2.1.0 phase 2: review-card row for the /ai dashboard.
// Renders a proposal's summary + rationale + payload preview and
// wires Apply / Dismiss buttons.

import { useState, useTransition } from "react";
import { applyProposal, dismissProposal, type PendingProposal } from "./actions";
import { InlineMarkdown } from "@/components/ai/MarkdownMessage";

export function ProposalReviewCard({ proposal }: { proposal: PendingProposal }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "pending" }
    | { kind: "applied" }
    | { kind: "dismissed" }
    | { kind: "error"; message: string }
  >({ kind: "pending" });

  const [showDetails, setShowDetails] = useState(false);

  function apply() {
    startTransition(async () => {
      const res = await applyProposal(proposal.id);
      setState(
        res.ok ? { kind: "applied" } : { kind: "error", message: res.error },
      );
    });
  }
  function dismiss() {
    startTransition(async () => {
      const res = await dismissProposal(proposal.id);
      setState(
        res.ok
          ? { kind: "dismissed" }
          : { kind: "error", message: (res as { error: string }).error },
      );
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-ink-tertiary">
            {proposal.kindLabel} · from {proposal.createdBy}
          </div>
          <div className="font-medium text-ink-primary">{proposal.summary}</div>
          {proposal.detail && (
            <div className="text-xs text-ink-secondary mt-0.5">{proposal.detail}</div>
          )}
          <div className="text-sm text-ink-secondary mt-1">
            <span className="italic">Why:</span> <InlineMarkdown text={proposal.rationale} />
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          {state.kind === "pending" && (
            <>
              <button
                type="button"
                onClick={apply}
                disabled={pending}
                className="rounded-md bg-ink-primary text-canvas px-3 py-1 text-sm disabled:opacity-60"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={dismiss}
                disabled={pending}
                className="rounded-md border border-border-soft text-ink-secondary px-3 py-1 text-sm disabled:opacity-60"
              >
                Dismiss
              </button>
            </>
          )}
          {state.kind === "applied" && (
            <span className="text-xs text-emerald-700">✓ Applied</span>
          )}
          {state.kind === "dismissed" && (
            <span className="text-xs text-ink-tertiary">Dismissed</span>
          )}
          {state.kind === "error" && (
            <span className="text-xs text-rose-700" title={state.message}>
              Failed
            </span>
          )}
        </div>
      </div>
      {state.kind === "error" && (
        <div className="mt-2 text-xs text-rose-700">{state.message}</div>
      )}
      <div className="mt-2 text-xs">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-ink-tertiary underline"
        >
          {showDetails ? "Hide details" : "Show details"}
        </button>
        {showDetails && (
          <pre className="mt-2 rounded-md bg-canvas border border-border-soft p-2 text-[11px] overflow-x-auto">
            {JSON.stringify(proposal.payload, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
