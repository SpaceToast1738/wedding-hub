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

// Build the secondary "breakdown" line for a given primary unit so the
// user gets full precision regardless of the toggle:
//   days   → "" (days is already the finest grain)
//   weeks  → "3 days" (or "")
//   months → "2 weeks 3 days" / "2 weeks" / "3 days" / ""
// Returns an empty string when nothing is left over so callers can hide
// the line cleanly.
function buildBreakdown(unit: Unit, now: Date, target: Date): string {
  if (unit === "days") return "";

  if (unit === "weeks") {
    const totalDays = ceilDays(now, target);
    const days = totalDays % 7;
    if (days === 0) return "";
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  // months
  const months = diffMonths(target, now);
  const afterMonths = addMonths(now, months);
  const daysAfterMonths = ceilDays(afterMonths, target);
  const weeks = Math.floor(daysAfterMonths / 7);
  const days = daysAfterMonths % 7;
  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(" ");
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
  const ms = target.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(ms / 86_400_000));
  const weeks = Math.ceil(days / 7);
  const months = diffMonths(target, now);

  const value = unit === "days" ? days : unit === "weeks" ? weeks : months;
  const breakdown = buildBreakdown(unit, now, target);
  const targetLabel = target.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <section className="mb-6 bg-surface border border-border-soft rounded-lg p-6 flex items-center justify-between gap-6 flex-wrap shadow-sm">
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center justify-between gap-3 mb-1">
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
                  "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors uppercase",
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
        <div className="font-display text-5xl font-semibold text-moss-700 leading-none">
          {value}
        </div>
        <div className="font-display text-base text-moss-700 mt-1 capitalize">{unit}</div>
        {breakdown && (
          <div className="text-xs text-ink-tertiary mt-1 tabular-nums">
            + {breakdown}
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="text-xs text-ink-tertiary">{targetLabel}</div>
        <div className="text-sm text-ink-secondary mt-0.5">{venueLabel}</div>
        <div className="text-sm text-ink-secondary">{ceremonyLabel}</div>
      </div>
    </section>
  );
}
