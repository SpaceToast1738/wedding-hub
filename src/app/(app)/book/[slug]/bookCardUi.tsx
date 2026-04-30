// v1.32.0: tiny shared helpers used across the per-kind card editors
// (BUILD / MENU / BAR / SETUP / LEGAL / future). All pure-ish — no DB
// access; the FieldLabel + Label primitives are a few lines of JSX.
//
// v1.34.0: lifted FieldLabel + Label out of the per-card files per
// the BOOK-EXPANSION-PLAN §10a temporary rule (edit-row layout). The
// pounds/pence helpers stay; same for newRowId.

import type { ReactNode } from "react";

export function formatGBPFromPence(pence: number | null | undefined): string {
  if (pence == null) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}

export function poundsStringToPence(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/£/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function penceToPoundsString(pence: number | null | undefined): string {
  if (pence == null) return "";
  return (pence / 100).toFixed(2);
}

export function newRowId(): string {
  return `new-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Edit-row layout primitives (v1.33.1) ─────────────────────────
//
// FieldLabel wraps a single grid cell (`className` carries the
// `sm:col-span-N` width); Label renders the small uppercase header
// shown above each input. The two together let any per-card editor
// use a `<div className="grid grid-cols-12">` row + per-cell labels
// with consistent styling. See BOOK-EXPANSION-PLAN §10a.

export function FieldLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`${className ?? ""} flex flex-col gap-1`}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
      {children}
    </span>
  );
}
