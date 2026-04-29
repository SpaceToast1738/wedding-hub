"use client";

import { Tag } from "@/components/ui/Tag";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
] as const;

export type Filter = (typeof FILTERS)[number]["value"];
export type View = "list" | "board";

export function FilterTabs({
  value,
  onChange,
  view,
  onViewChange,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  view: View;
  onViewChange: (v: View) => void;
}) {
  return (
    <div className="px-4 sm:px-6 py-2 flex gap-1.5 overflow-auto flex-shrink-0 items-center">
      {FILTERS.map((f) => (
        <Tag key={f.value} label={f.label} active={value === f.value} onClick={() => onChange(f.value)} />
      ))}
      <span className="flex-1" />
      <div className="flex gap-px bg-canvas border border-border-soft rounded-full p-0.5 flex-shrink-0">
        {(["list", "board"] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={[
              "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors uppercase",
              view === v ? "bg-moss-500 text-white" : "text-ink-tertiary hover:text-ink-primary",
            ].join(" ")}
            aria-pressed={view === v}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
