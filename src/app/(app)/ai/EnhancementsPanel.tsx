"use client";

// v2.8.0 (§C2): couple-facing list of agent-filed enhancement
// suggestions (dev backlog for the website / MCP / AI surface).
// Rows come from listEnhancementSuggestions() in page.tsx — the page
// hides the whole section when there are none (repo convention), so
// this component always has at least one row to show. The status
// select is couple-only; everyone else sees a read-only pill.

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  setEnhancementStatus,
  type EnhancementSuggestionRow,
} from "./enhancement-actions";

const STATUSES = ["NEW", "PLANNED", "DONE", "DECLINED"] as const;

// Same token mapping StatusPill.tsx uses — raw Tailwind palette
// colors don't remap for dark mode (see v2.5.0 note there).
const AREA_BADGES: Record<string, string> = {
  WEBSITE: "bg-info-bg text-info border-info-border dark:bg-muted dark:border-border-soft",
  MCP: "bg-moss-50 text-moss-700 border-moss-100",
  AI: "bg-marigold-100 text-marigold-700 border-marigold-200 dark:border-marigold-700",
};

const STATUS_BADGES: Record<string, string> = {
  NEW: "bg-marigold-100 text-marigold-700 border-marigold-200 dark:border-marigold-700",
  PLANNED: "bg-info-bg text-info border-info-border dark:bg-muted dark:border-border-soft",
  DONE: "bg-moss-50 text-moss-700 border-moss-100",
  DECLINED: "bg-muted text-ink-tertiary border-border-soft",
};

const FALLBACK_BADGE = "bg-muted text-ink-tertiary border-border-soft";

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium tracking-tight ${className}`}
    >
      {label}
    </span>
  );
}

export function EnhancementsPanel({
  suggestions,
  isCouple,
}: {
  suggestions: EnhancementSuggestionRow[];
  isCouple: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Optimistic status per row so the select doesn't snap back while
  // the action round-trips; revalidatePath("/ai") refreshes the real
  // rows afterwards.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function changeStatus(id: string, next: string) {
    setError(null);
    setOverrides((prev) => ({ ...prev, [id]: next }));
    startTransition(async () => {
      const res = await setEnhancementStatus(id, next);
      if (!res.ok) {
        setError(res.error);
        setOverrides((prev) => {
          const rest = { ...prev };
          delete rest[id];
          return rest;
        });
      }
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface">
      {error && (
        <div className="m-3 mb-0 rounded-md border border-danger-border bg-danger-bg p-2 text-xs text-danger">
          ✗ {error}
        </div>
      )}
      <ul className="divide-y divide-border-soft">
        {suggestions.map((s) => {
          const status = overrides[s.id] ?? s.status;
          const expanded = expandedId === s.id;
          return (
            <li key={s.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                  aria-expanded={expanded}
                  className="min-w-0 flex-1 text-left group"
                >
                  <span className="flex items-center gap-2">
                    <Badge
                      label={s.area}
                      className={AREA_BADGES[s.area] ?? FALLBACK_BADGE}
                    />
                    <span className="text-sm font-medium text-ink-primary truncate group-hover:underline">
                      {s.title}
                    </span>
                    {expanded ? (
                      <ChevronDown aria-hidden className="w-3.5 h-3.5 flex-shrink-0 text-ink-tertiary" />
                    ) : (
                      <ChevronRight aria-hidden className="w-3.5 h-3.5 flex-shrink-0 text-ink-tertiary" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-tertiary">
                    {s.createdBy} · {s.createdAt.slice(0, 10)}
                  </span>
                </button>
                {isCouple ? (
                  <select
                    value={status}
                    disabled={pending}
                    onChange={(e) => changeStatus(s.id, e.target.value)}
                    aria-label={`Status for "${s.title}"`}
                    className="flex-shrink-0 text-xs bg-canvas border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 disabled:opacity-50"
                  >
                    {STATUSES.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge
                    label={status}
                    className={STATUS_BADGES[status] ?? FALLBACK_BADGE}
                  />
                )}
              </div>
              {expanded && (
                <div className="mt-2 text-sm text-ink-secondary whitespace-pre-wrap">
                  {s.detail}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
