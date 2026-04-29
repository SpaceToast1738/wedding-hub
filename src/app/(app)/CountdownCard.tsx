"use client";

import { useEffect, useState } from "react";
import { IllusCountdown } from "@/components/ui/Illustrations";

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
  coupleLabel,
}: {
  targetIso: string;
  venueLabel: string;
  // v1.19.0: replaces the old `ceremonyLabel` prop. The mockup shows
  // "Jamie & Bryony's Wedding" + "26 September 2026 · Alveston Manor"
  // inside the card; the ceremony-time line is now part of the
  // schedule, not the countdown.
  coupleLabel: string;
}) {
  const [unit, setUnit] = useState<Unit>("days");
  // v1.22.5 hydration fix: `new Date()` at render time gave different
  // values on SSR vs client mount, which made `buildBreakdown` produce
  // a different first segment between the two. React's strict
  // hydration check threw #418 / #482 on navigation. Compute `now`
  // only after mount; render a stable placeholder before then.
  const [now, setNow] = useState<Date | null>(null);
  // v1.22.5 persistence fix: pre-fix, the save effect ran on mount
  // with the default state value and overwrote whatever the user had
  // saved before the load effect could swap it in. Gate the save on
  // `loaded` so it only fires after the initial read completes.
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount + seed `now` for the first client
  // render. The interval keeps the countdown live (one tick a minute is
  // enough — the displayed unit is days/weeks/months).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "months" || saved === "weeks" || saved === "days") setUnit(saved);
    } catch {
      // ignore — non-critical preference
    }
    setLoaded(true);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, unit);
    } catch {
      // ignore
    }
  }, [unit, loaded]);

  const target = new Date(targetIso);
  // `breakdown` is null until `now` is set. The render below treats
  // null as "loading" — same markup on SSR + first client paint, no
  // hydration mismatch.
  const breakdown = now ? buildBreakdown(unit, now, target) : null;
  const targetLabel = target.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    // v1.19.0: marigold/cream tinted background per the mockup. The
    // IllusCountdown watermark sits absolute top-right at 18% opacity
    // (the SVG handles its own positioning); the parent has
    // `relative overflow-hidden` so it clips inside the rounded
    // corners.
    <section className="relative overflow-hidden bg-marigold-100/60 border border-marigold-700/15 rounded-lg p-6 shadow-sm h-full flex flex-col">
      <IllusCountdown />
      <div className="relative flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-[10px] text-marigold-700 uppercase tracking-wider font-bold">
            Until the wedding
          </div>
          <div className="flex gap-px bg-surface/80 border border-marigold-700/15 rounded-full p-0.5">
            {(["months", "weeks", "days"] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={[
                  "text-xs px-3 py-1 sm:text-[10px] sm:px-2 sm:py-0.5 rounded-full font-semibold transition-colors uppercase",
                  unit === u
                    ? "bg-moss-700 text-white"
                    : "text-ink-tertiary hover:text-ink-primary",
                ].join(" ")}
                aria-pressed={unit === u}
              >
                {u[0]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          {/* Stack the segments vertically so the giant first number
              gets full prominence (matches the mockup); when there's a
              breakdown (W/M units), the smaller segments wrap below
              with consistent label sizing. */}
          {breakdown === null ? (
            // Pre-mount placeholder — same markup on SSR and first
            // client render, so React's hydration check passes. Swaps
            // in the real number once `now` lands.
            <>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-display text-6xl font-semibold text-moss-700/40 leading-none tabular-nums">
                  —
                </span>
              </div>
              <div className="font-display text-xl text-moss-700/40 capitalize mb-3">
                {unit}
              </div>
            </>
          ) : breakdown.length > 0 ? (
            <>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-display text-6xl font-semibold text-moss-700 leading-none tabular-nums">
                  {breakdown[0]!.value}
                </span>
              </div>
              <div className="font-display text-xl text-moss-700 capitalize mb-3">
                {breakdown[0]!.label}
              </div>
              {breakdown.length > 1 && (
                <div className="flex items-baseline gap-2 flex-wrap text-moss-700 -mt-2 mb-3">
                  {breakdown.slice(1).map((part, i) => (
                    <span key={part.label} className="text-sm">
                      {i > 0 && <span className="text-moss-700/40 mr-1">·</span>}
                      <span className="font-semibold tabular-nums">{part.value}</span>{" "}
                      <span className="capitalize">{part.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="mt-auto">
          <div className="font-display text-base font-semibold text-marigold-700">
            {coupleLabel}
          </div>
          <div className="text-xs text-ink-secondary mt-0.5">
            {targetLabel} · {venueLabel}
          </div>
        </div>
      </div>
    </section>
  );
}
