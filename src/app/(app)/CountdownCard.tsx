"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wh_countdown_unit";
type Unit = "months" | "weeks" | "days";

function diffMonths(target: Date, now: Date): number {
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  const dayDiff = target.getDate() - now.getDate();
  return Math.max(0, months + (dayDiff >= 0 ? 0 : -1));
}

// Add `months` calendar months to `from`, returning the new Date. Used by
// the multi-unit breakdown to compute the leftover-days after stripping
// out whole months.
function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

// Whole days between two dates, ceiling. Negative inputs clamp to 0.
function ceilDays(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
}

type BreakdownPart = { value: number; label: string };

// Build the multi-segment breakdown so every part renders at the same
// visual prominence. Always includes the primary unit's segment, then
// stacks finer-grained leftovers as separate segments. Examples:
//   unit=days, target in 2 days   → [{2, "days"}]
//   unit=weeks, target in 17 days → [{2, "weeks"}, {3, "days"}]
//   unit=months, target in 4 mo + 2 wk + 3 d → [{4, "months"}, {2, "weeks"}, {3, "days"}]
// Zero-value finer segments are dropped (e.g. "exactly 2 weeks" → just
// the weeks part).
function buildBreakdown(unit: Unit, now: Date, target: Date): BreakdownPart[] {
  if (unit === "days") {
    const days = ceilDays(now, target);
    return [{ value: days, label: days === 1 ? "day" : "days" }];
  }

  if (unit === "weeks") {
    const totalDays = ceilDays(now, target);
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    const parts: BreakdownPart[] = [{ value: weeks, label: weeks === 1 ? "week" : "weeks" }];
    if (days > 0) parts.push({ value: days, label: days === 1 ? "day" : "days" });
    return parts;
  }

  // months
  const months = diffMonths(target, now);
  const afterMonths = addMonths(now, months);
  const daysAfterMonths = ceilDays(afterMonths, target);
  const weeks = Math.floor(daysAfterMonths / 7);
  const days = daysAfterMonths % 7;
  const parts: BreakdownPart[] = [{ value: months, label: months === 1 ? "month" : "months" }];
  if (weeks > 0) parts.push({ value: weeks, label: weeks === 1 ? "week" : "weeks" });
  if (days > 0) parts.push({ value: days, label: days === 1 ? "day" : "days" });
  return parts;
}

export function CountdownCard({
  targetIso,
  venueLabel,
  ceremonyLabel,
}: {
  targetIso: string;
  venueLabel: string;
  ceremonyLabel: string;
}) {
  const [unit, setUnit] = useState<Unit>("days");

  // Load saved preference on mount; SSR renders 'days' so the markup is stable.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "months" || saved === "weeks" || saved === "days") setUnit(saved);
    } catch {
      // ignore — non-critical preference
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, unit);
    } catch {
      // ignore
    }
  }, [unit]);

  const target = new Date(targetIso);
  const now = new Date();
  const breakdown = buildBreakdown(unit, now, target);
  const targetLabel = target.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <section className="mb-6 bg-surface border border-border-soft rounded-lg p-6 flex items-center justify-between gap-6 flex-wrap shadow-sm">
      <div className="flex-1 min-w-0 sm:min-w-[200px]">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-xs text-ink-tertiary uppercase tracking-wider font-semibold">
            Until the wedding
          </div>
          <div className="flex gap-px bg-canvas border border-border-soft rounded-full p-0.5">
            {(["months", "weeks", "days"] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={[
                  // Bigger tap targets on mobile (≥32px); compress on desktop
                  // where the same row already has plenty of breathing room.
                  "text-xs px-3 py-1 sm:text-[10px] sm:px-2 sm:py-0.5 rounded-full font-semibold transition-colors uppercase",
                  unit === u
                    ? "bg-moss-500 text-white"
                    : "text-ink-tertiary hover:text-ink-primary",
                ].join(" ")}
                aria-pressed={unit === u}
              >
                {u[0]}
              </button>
            ))}
          </div>
        </div>
        {/* v1.17.0: render the breakdown inline as equally-prominent
            segments. When unit=days there's just one segment; when
            unit=weeks/months there can be 2–3, separated by a dot. */}
        <div className="flex items-baseline gap-3 flex-wrap">
          {breakdown.map((part, i) => (
            <div key={part.label} className="flex items-baseline gap-2">
              {i > 0 && <span className="text-moss-700/30 text-2xl leading-none">·</span>}
              <span className="font-display text-5xl font-semibold text-moss-700 leading-none tabular-nums">
                {part.value}
              </span>
              <span className="font-display text-base text-moss-700 capitalize">
                {part.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-ink-tertiary">{targetLabel}</div>
        <div className="text-sm text-ink-secondary mt-0.5">{venueLabel}</div>
        <div className="text-sm text-ink-secondary">{ceremonyLabel}</div>
      </div>
    </section>
  );
}
