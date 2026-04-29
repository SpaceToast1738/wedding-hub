"use client";

import { Tag } from "@/components/ui/Tag";

// v1.27.4: Filter is now a string (predefined or category-name) so we
// can mix the legacy {all, mine, open, done} options with dynamic
// category-tag pills (Budget, Groom Prep, etc.) computed from the
// current task list's tags. Plus a synthetic "questions" pill that
// toggles `type` filter to QUESTION/DECISION instead of TASK.
export type Filter = string;
export type View = "list" | "board";

// Predefined filters that always appear (in this order).
const PREDEFINED: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "questions", label: "Questions" },
  { value: "done", label: "Done" },
];

export function FilterTabs({
  value,
  onChange,
  categories,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  /** Distinct category values from the current task set. */
  categories: string[];
}) {
  return (
    <div className="px-4 sm:px-6 py-2 flex gap-1.5 overflow-auto flex-shrink-0 items-center">
      {PREDEFINED.map((f) => (
        <Tag
          key={f.value}
          label={f.label}
          active={value === f.value}
          onClick={() => onChange(f.value)}
        />
      ))}
      {categories.map((c) => (
        <Tag
          key={`cat:${c}`}
          label={c}
          active={value === `cat:${c}`}
          onClick={() => onChange(`cat:${c}`)}
        />
      ))}
      {/* "+ View" placeholder — saved-views feature is a backlog item.
          For now it's a visual stub that mirrors the design mockup. */}
      <Tag label="+ View" active={false} onClick={() => { /* TODO: saved views */ }} />
    </div>
  );
}
