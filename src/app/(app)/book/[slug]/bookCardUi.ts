// v1.32.0: tiny shared helpers used across the per-kind card editors
// (BUILD / MENU / BAR / future). All pure — no React, no DB.
//
// These exist because every card kind's editor needs the same
// pounds-and-pence ↔ integer-pence conversion for £ inputs and the
// same "new-XYZ" id discriminator for newly-added rows in bulk-save
// payloads.

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
