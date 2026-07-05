"use client";

// v2.2.0: batch group on the /ai dashboard. One header with
// select-all / apply-selected / dismiss-all over N proposals that
// share a batchId. Singletons render the existing ProposalReviewCard.

import { useState, useTransition } from "react";
import {
  applyProposals,
  dismissProposals,
  type BatchItemResult,
  type PendingProposal,
} from "./actions";
import { InlineMarkdown } from "@/components/ai/MarkdownMessage";

type ItemState =
  | { kind: "pending" }
  | { kind: "applied" }
  | { kind: "dismissed" }
  | { kind: "error"; message: string };

export function ProposalBatchGroup({ proposals }: { proposals: PendingProposal[] }) {
  const [pending, startTransition] = useTransition();
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Map<string, ItemState>>(new Map());
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set());

  const stateOf = (id: string): ItemState => states.get(id) ?? { kind: "pending" };
  // "error" items stay actionable — a failed apply rolls the server-side
  // claim back to PENDING, so retrying is legitimate.
  const actionable = (id: string) => {
    const k = stateOf(id).kind;
    return k === "pending" || k === "error";
  };
  const pendingItems = proposals.filter((p) => actionable(p.id));
  const selectedIds = pendingItems
    .filter((p) => !deselected.has(p.id))
    .map((p) => p.id);
  const allSelected = pendingItems.length > 0 && selectedIds.length === pendingItems.length;

  function toggle(id: string) {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setDeselected(
      allSelected ? new Set(pendingItems.map((p) => p.id)) : new Set(),
    );
  }

  function toggleDetails(id: string) {
    setShowDetails((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function ingest(results: BatchItemResult[], okStatus: "applied" | "dismissed") {
    setStates((prev) => {
      const next = new Map(prev);
      for (const r of results) {
        next.set(
          r.id,
          r.ok
            ? { kind: okStatus }
            : { kind: "error", message: r.error ?? "Failed" },
        );
      }
      return next;
    });
  }

  function onApplySelected() {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const { results } = await applyProposals(selectedIds);
      ingest(results, "applied");
    });
  }
  function onDismissAll() {
    const ids = pendingItems.map((p) => p.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const { results } = await dismissProposals(ids);
      ingest(results, "dismissed");
    });
  }

  const head = proposals[0];
  if (!head) return null;
  const handled = proposals.length - pendingItems.length;

  return (
    <div className="rounded-md border border-border-soft bg-surface p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {pendingItems.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={pending}
              aria-label="Select all proposals in this batch"
            />
          )}
          <div className="text-xs uppercase tracking-wide text-ink-tertiary truncate">
            Batch · {proposals.length} proposal{proposals.length === 1 ? "" : "s"} · from{" "}
            {head.createdBy}
            {handled > 0 && ` · ${handled} handled`}
          </div>
        </div>
        {pendingItems.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onApplySelected}
              disabled={pending || selectedIds.length === 0}
              className="rounded-md bg-ink-primary text-canvas px-3 py-1 text-sm disabled:opacity-50"
            >
              {pending ? "Working…" : `Apply selected (${selectedIds.length})`}
            </button>
            <button
              type="button"
              onClick={onDismissAll}
              disabled={pending}
              className="rounded-md border border-border-soft text-ink-secondary px-3 py-1 text-sm disabled:opacity-60"
            >
              Dismiss all
            </button>
          </div>
        )}
      </div>

      <ul className="divide-y divide-border-soft">
        {proposals.map((p) => {
          const st = stateOf(p.id);
          return (
            <li key={p.id} className="py-2 flex items-start gap-2">
              {st.kind === "pending" || st.kind === "error" ? (
                <input
                  type="checkbox"
                  checked={!deselected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  disabled={pending}
                  className="mt-1 flex-shrink-0"
                  aria-label={`Include "${p.summary}"`}
                />
              ) : (
                <span className="mt-0.5 w-4 flex-shrink-0 text-center text-xs">
                  {st.kind === "applied" ? "✓" : "–"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wide text-ink-tertiary">
                  {p.kindLabel}
                </div>
                <div
                  className={`text-sm font-medium ${
                    st.kind === "dismissed"
                      ? "text-ink-tertiary line-through"
                      : "text-ink-primary"
                  }`}
                >
                  {p.summary}
                </div>
                {p.detail && (
                  <div className="text-xs text-ink-secondary">{p.detail}</div>
                )}
                <div className="text-xs text-ink-secondary mt-0.5">
                  <span className="italic">Why:</span> <InlineMarkdown text={p.rationale} />
                </div>
                {st.kind === "error" && (
                  <div className="text-xs text-rose-700 mt-0.5">{st.message}</div>
                )}
                <button
                  type="button"
                  onClick={() => toggleDetails(p.id)}
                  className="text-[11px] text-ink-tertiary underline mt-0.5"
                >
                  {showDetails.has(p.id) ? "Hide payload" : "Show payload"}
                </button>
                {showDetails.has(p.id) && (
                  <pre className="mt-1 rounded-md bg-canvas border border-border-soft p-2 text-[11px] overflow-x-auto">
                    {JSON.stringify(p.payload, null, 2)}
                  </pre>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
