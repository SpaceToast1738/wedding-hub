"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wh_countdown_unit";
type Unit = "months" | "weeks" | "days";

function diffMonths(target: Date, now: Date): number {
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  const dayDiff = target.getDate() - now.getDate();
  return Math.max(0, months + (dayDiff >= 0 ? 0 : -1));
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
      </div>
      <div className="text-right">
        <div className="text-xs text-ink-tertiary">{targetLabel}</div>
        <div className="text-sm text-ink-secondary mt-0.5">{venueLabel}</div>
        <div className="text-sm text-ink-secondary">{ceremonyLabel}</div>
      </div>
    </section>
  );
}
