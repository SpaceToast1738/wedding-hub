"use client";

// v2.1.0 phase 6: state-of-the-wedding review.
// One expensive Opus call reads across every surface (tasks, guests,
// budget when visible, schedule, wedding book, suppliers) and returns
// a structured report — headline, on-track areas, concerns ranked by
// severity, next-step actions. Meant for periodic health checks; the
// rate limit is intentionally low.

import { useState, useTransition } from "react";
import { reviewWeddingState, type WeddingReview } from "./actions";

const SEVERITY_STYLES: Record<
  "high" | "medium" | "low",
  { badge: string; row: string; label: string }
> = {
  high: {
    badge: "bg-rose-100 text-rose-900 border-rose-300",
    row: "border-rose-300 bg-rose-50/60",
    label: "High",
  },
  medium: {
    badge: "bg-amber-100 text-amber-900 border-amber-300",
    row: "border-amber-300 bg-amber-50/50",
    label: "Medium",
  },
  low: {
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    row: "border-slate-200 bg-slate-50/60",
    label: "Low",
  },
};

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function WeddingReviewPanel() {
  const [pending, startTransition] = useTransition();
  const [review, setReview] = useState<WeddingReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await reviewWeddingState();
      if (res.ok) setReview(res.review);
      else setError(res.error);
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-ink-secondary min-w-0">
          Run a full pass across the whole app — tasks, guests, schedule,
          wedding book, suppliers, and (if you can see it) the budget — and get
          back a state-of-the-wedding report. Uses the deep model; expect a
          15–30 second wait and about 5–10p per run.
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="flex-shrink-0 rounded-md bg-ink-primary text-canvas px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {pending ? "Reviewing…" : review ? "Re-run review" : "✨ Review the wedding"}
        </button>
      </div>
      {error && (
        <div className="text-xs text-rose-700 rounded-md border border-rose-300 bg-rose-50 p-2">
          ✗ {error}
        </div>
      )}
      {review && <ReviewBody review={review} />}
    </div>
  );
}

function ReviewBody({ review }: { review: WeddingReview }) {
  return (
    <div className="space-y-4 pt-2 border-t border-border-soft">
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-tertiary">
          Headline · {review.weeksToWedding} weeks to go · {formatTimeAgo(review.generatedAt)}
        </div>
        <div className="text-base font-semibold text-ink-primary mt-1">
          {review.headline}
        </div>
      </div>

      {review.concerns.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            Concerns ({review.concerns.length})
          </h3>
          <div className="space-y-2">
            {review.concerns.map((c, i) => {
              const styles = SEVERITY_STYLES[c.severity];
              return (
                <div
                  key={i}
                  className={`rounded-md border p-3 text-sm ${styles.row}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}
                    >
                      {styles.label}
                    </span>
                    <span className="text-ink-primary font-semibold">{c.area}</span>
                  </div>
                  <div className="text-ink-primary">{c.issue}</div>
                  <div className="text-ink-secondary mt-1">
                    <span className="italic">Suggestion:</span> {c.suggestion}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {review.nextSteps.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            Next steps this week
          </h3>
          <ol className="list-decimal ml-5 space-y-1 text-sm text-ink-primary">
            {review.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {review.onTrack.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            On track
          </h3>
          <ul className="space-y-1 text-sm text-ink-secondary">
            {review.onTrack.map((n, i) => (
              <li key={i}>
                <span className="text-emerald-700">✓</span>{" "}
                <span className="text-ink-primary font-medium">{n.area}:</span>{" "}
                {n.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[11px] text-ink-tertiary pt-2 border-t border-border-soft">
        This review cost {(review.costPence / 100).toFixed(2)}p. The AI can be
        wrong — sanity-check anything critical before you act.
      </div>
    </div>
  );
}
