// v2.16.1: seat labels on the canvas wrap to a second line instead of
// truncating with "…" when the first name has a natural break in it.
//
// Rules (pure, unit-tested):
//   - fits on one line → one line, untouched
//   - too long but contains a space or hyphen → break at the LAST
//     break-point that keeps line 1 within budget ("Bryony-Olwyn" →
//     ["Bryony-", "Olwyn"]; "Katherine (Kat)" → ["Katherine", "(Kat)"]).
//     A hyphen stays on the end of line 1, a space is dropped.
//   - no usable break-point → single-line truncation as before
//   - never more than two lines; the second line is truncated if it's
//     still over budget.

const MAX_LINES = 2;

export function wrapSeatLabel(name: string, maxChars: number): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  // Find the last break-point whose line-1 length fits. `end` is the
  // exclusive index of the line-1 text; `next` is where line 2 starts.
  let end = -1;
  let next = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (ch === " ") {
      if (i <= maxChars && i > 0) { end = i; next = i + 1; }
    } else if (ch === "-" || ch === "‑") {
      if (i + 1 <= maxChars && i + 1 < trimmed.length) { end = i + 1; next = i + 1; }
    }
  }
  if (end <= 0) return [truncate(trimmed, maxChars)];

  const first = trimmed.slice(0, end).trim();
  const rest = trimmed.slice(next).trim();
  if (!rest) return [truncate(first, maxChars)];
  return [first, truncate(rest, maxChars)].slice(0, MAX_LINES);
}

export function truncate(s: string, maxChars: number): string {
  return s.length > maxChars ? `${s.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…` : s;
}
