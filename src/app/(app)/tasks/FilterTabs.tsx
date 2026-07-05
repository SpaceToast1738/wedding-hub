"use client";

import { Tag } from "@/components/ui/Tag";

// v1.27.4: Filter is a plain string so predefined values (all, mine,
// done, …) and synthetic ones (e.g. "questions" toggling `type` to
// QUESTION/DECISION) share one type.
//
// v2.5.0 (mod #4): dropped the dynamic category-tag pills — the
// category field was cut from the write path in v1.96.0, so every
// task created since had no `tags[0]` to generate a pill from.
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
  overdueCount,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  // v2.5.0 (CRITICAL #2): count of open tasks past their due date —
  // gives the new "Overdue" pill a live badge.
  overdueCount: number;
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
      <Tag
        label={`Overdue${overdueCount > 0 ? ` · ${overdueCount}` : ""}`}
        active={value === "overdue"}
        onClick={() => onChange("overdue")}
      />
      {/* "+ View" placeholder — saved-views feature is a backlog item.
          For now it's a visual stub that mirrors the design mockup. */}
      <Tag label="+ View" active={false} onClick={() => { /* TODO: saved views */ }} />
    </div>
  );
}
