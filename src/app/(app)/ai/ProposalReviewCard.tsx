"use client";

// v2.1.0 phase 2: review-card row for the /ai dashboard.
// Renders a proposal's summary + rationale + payload preview and
// wires Apply / Dismiss buttons.

import { useState, useTransition } from "react";
import { applyProposal, dismissProposal, type PendingProposal } from "./actions";
import { InlineMarkdown } from "@/components/ai/MarkdownMessage";

// v2.5.0: fields the raw payload carries purely for wiring the update
// to its target row — the summary/detail line above already names
// that target in plain English (e.g. "→ Sarah · Flowers"), so
// repeating the raw id here would just be noise.
const PAYLOAD_ID_FIELDS = new Set([
  "taskId", "eventId", "guestId", "householdId", "supplierId",
  "sectionId", "cardId", "budgetLineId", "budgetCategoryId",
  "paymentId", "playlistId", "targetId", "contactId", "shotId",
  "batchId",
]);

function humanizeFieldKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanizeFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map(humanizeFieldValue).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Field-by-field readable view of a proposal payload — replaces a
 *  raw JSON dump that was the ONLY way to see what an update would
 *  actually change, meaningless to a non-technical reviewer. Not
 *  schema-aware (40 proposal kinds and counting); just humanises
 *  whatever keys are present and skips internal id fields. */
function PayloadFields({ payload }: { payload: unknown }) {
  const entries = Object.entries((payload ?? {}) as Record<string, unknown>).filter(
    ([key, value]) => !PAYLOAD_ID_FIELDS.has(key) && value !== undefined,
  );
  if (entries.length === 0) {
    return <div className="text-ink-tertiary">No fields to show.</div>;
  }
  return (
    <dl className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <dt className="text-ink-tertiary flex-shrink-0">{humanizeFieldKey(key)}:</dt>
          <dd className="text-ink-primary min-w-0 break-words">{humanizeFieldValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProposalReviewCard({ proposal }: { proposal: PendingProposal }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "pending" }
    | { kind: "applied" }
    | { kind: "dismissed" }
    | { kind: "error"; message: string }
  >({ kind: "pending" });

  const [showDetails, setShowDetails] = useState(false);
  // v2.5.0: field view is the default — raw JSON is one more toggle
  // away for anyone who wants it (developers, or a reviewer double-
  // checking an edge case).
  const [rawView, setRawView] = useState(false);

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
            <span className="text-xs text-moss-700">✓ Applied</span>
          )}
          {state.kind === "dismissed" && (
            <span className="text-xs text-ink-tertiary">Dismissed</span>
          )}
          {state.kind === "error" && (
            <span className="text-xs text-danger" title={state.message}>
              Failed
            </span>
          )}
        </div>
      </div>
      {state.kind === "error" && (
        <div className="mt-2 text-xs text-danger">{state.message}</div>
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
          <div className="mt-2 rounded-md bg-canvas border border-border-soft p-2 text-[11px] space-y-2">
            {rawView ? (
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(proposal.payload, null, 2)}
              </pre>
            ) : (
              <PayloadFields payload={proposal.payload} />
            )}
            <button
              type="button"
              onClick={() => setRawView((v) => !v)}
              className="text-ink-tertiary underline"
            >
              {rawView ? "Show as fields" : "Show raw JSON"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
