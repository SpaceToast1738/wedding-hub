"use client";

import { Tag } from "@/components/ui/Tag";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
] as const;

export type Filter = (typeof FILTERS)[number]["value"];

export function FilterTabs({ value, onChange }: { value: Filter; onChange: (v: Filter) => void }) {
  return (
    <div className="px-6 py-2.5 border-b border-border-soft bg-surface flex gap-1.5 overflow-auto flex-shrink-0">
      {FILTERS.map((f) => (
        <Tag key={f.value} label={f.label} active={value === f.value} onClick={() => onChange(f.value)} />
      ))}
    </div>
  );
}
