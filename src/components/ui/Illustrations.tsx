// C6 (v1.15.0): SVG illustrations ported from prototype/illustrations.jsx.
//
// All use CSS-variable theming so they pick up dark mode automatically
// (production tokens use a `--color-*` prefix; the prototype was un-prefixed).
//
// Three families:
//   - Scenes (48px) — used on the Wedding Book hub cards.
//   - Empty-state (120×100) — used on list pages with no items.
//   - Countdown decoration (240×140) — semi-transparent overlay for the
//     hero card on the homepage.
//
// The motif icons (ring/candle/plate/camera/bouquet/suitcase) live in
// `EventMotifIcon.tsx` — kept separate because they have a heuristic
// classifier paired with them.
//
// ── Empty-state convention (DP-3, codified v1.64.0) ──────────────────
//
// Two tiers:
//
//   1. **Top-level page empties** — when a whole feature page has zero
//      rows. Use `<EmptyState illustration={EmptyTasks} title=…
//      body=… action={<AddX />} />`. Bigger, illustrated, encouraging.
//      Sites: /tasks, /guests, /schedule, /seating, /payments.
//
//   2. **Nested-section empties** — when a sub-list inside a page has
//      zero rows (no notes on this card, no items in this section,
//      no households yet). Use a single short italic paragraph:
//      `<p className="text-xs text-ink-tertiary italic">No X yet.</p>`.
//      Terse, doesn't dominate the surrounding chrome.
//
// The shared verb is "Add" — never "Create", "Drop", or any other
// alternative (P1, v1.60.0). Direction word ("above" / "below") matches
// where the action affordance actually sits relative to the empty
// state. Both tiers respect this.
//
// New empty states should pick the appropriate tier and not invent a
// third pattern. If a new top-level page needs an illustration that
// doesn't exist, add it to the Empty-state family below.

// ── Decorative watermarks ──────────────────────────────────────────────────

// IllusCountdown: a 240×140 watermark for the homepage countdown card.
// Renders at 18% opacity, absolutely positioned top-right inside the
// card. Caller sets `position: relative` on the parent and gives the
// card enough height for the watermark not to crowd the text.
export function IllusCountdown({ width = 240, height = 140 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 240 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ opacity: 0.18, position: "absolute", top: 0, right: 0, pointerEvents: "none" }}
    >
      <path d="M220 10 C200 30 190 60 200 80 C210 60 230 35 220 10Z" fill="var(--color-moss-500)" stroke="var(--color-moss-700)" strokeWidth="1" />
      <path d="M220 10 L200 80" stroke="var(--color-moss-700)" strokeWidth="0.8" />
      <path d="M195 20 C180 35 178 55 188 65 C192 50 200 28 195 20Z" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="0.8" />
      <path d="M195 20 L188 65" stroke="var(--color-moss-500)" strokeWidth="0.6" />
      <rect x="110" y="90" width="12" height="32" rx="2" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1" />
      <path d="M116 82 C116 82 120 88 116 92 C112 88 116 82 116 82Z" fill="var(--color-marigold-500)" stroke="var(--color-marigold-700)" strokeWidth="0.8" />
      <line x1="100" y1="122" x2="132" y2="122" stroke="var(--color-moss-500)" strokeWidth="1" />
      <path d="M60 100 C70 90 80 110 90 100 C100 90 110 110 120 100" stroke="var(--color-marigold-500)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── Scene illustrations (48px) ──────────────────────────────────────────────

export function IllusWeddingParty({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="24" cy="18" r="8" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <path d="M18 18 C18 14 21 12 24 12 C27 12 30 14 30 18" stroke="var(--color-moss-500)" strokeWidth="1" fill="none" />
      <path d="M16 34 C16 28 20 25 24 25 C28 25 32 28 32 34" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <path d="M8 22 C10 18 13 19 14 22" stroke="var(--color-moss-300)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M40 22 C38 18 35 19 34 22" stroke="var(--color-moss-300)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="22" r="3" fill="var(--color-moss-50)" stroke="var(--color-moss-300)" strokeWidth="1" />
      <circle cx="36" cy="22" r="3" fill="var(--color-moss-50)" stroke="var(--color-moss-300)" strokeWidth="1" />
      <circle cx="24" cy="38" r="4" fill="var(--color-marigold-100)" stroke="var(--color-marigold-500)" strokeWidth="1" />
      <circle cx="20" cy="40" r="2.5" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="0.8" />
      <circle cx="28" cy="40" r="2.5" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="0.8" />
    </svg>
  );
}

export function IllusVenue({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="8" y="20" width="32" height="24" rx="1" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <path d="M8 20 C8 20 24 8 40 20" fill="var(--color-moss-50)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <path d="M18 44 L18 32 C18 28 30 28 30 32 L30 44" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="10" y="26" width="6" height="7" rx="1" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <rect x="32" y="26" width="6" height="7" rx="1" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <path d="M8 24 C6 22 4 26 6 28" stroke="var(--color-moss-500)" strokeWidth="0.8" fill="none" />
      <ellipse cx="5" cy="24" rx="2" ry="1.5" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="0.6" />
    </svg>
  );
}

export function IllusFood({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <ellipse cx="24" cy="40" rx="14" ry="3" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="22" y="30" width="4" height="10" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1" />
      <rect x="12" y="28" width="24" height="10" rx="3" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="16" y="18" width="16" height="10" rx="3" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="20" y="10" width="8" height="8" rx="2" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <circle cx="24" cy="10" r="1.5" fill="var(--color-marigold-500)" />
      <path d="M12 33 C16 30 20 36 24 33 C28 30 32 36 36 33" stroke="var(--color-moss-300)" strokeWidth="0.8" fill="none" />
      <path d="M16 23 C19 21 21 25 24 23 C27 21 29 25 32 23" stroke="var(--color-moss-300)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

export function IllusPhotography({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="4" y="14" width="40" height="28" rx="4" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <circle cx="24" cy="28" r="8" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <circle cx="24" cy="28" r="4.5" fill="var(--color-moss-50)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <path d="M16 14 L18 10 H30 L32 14" stroke="var(--color-moss-500)" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <circle cx="36" cy="20" r="2" fill="var(--color-marigold-500)" />
      <path d="M24 20 C28 22 28 34 24 36" stroke="var(--color-moss-500)" strokeWidth="0.7" fill="none" />
      <path d="M24 20 C20 22 20 34 24 36" stroke="var(--color-moss-500)" strokeWidth="0.7" fill="none" />
    </svg>
  );
}

export function IllusGuestExp({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="8" y="12" width="32" height="28" rx="3" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="12" y="16" width="24" height="20" rx="2" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="20" y1="16" x2="20" y2="36" stroke="var(--color-moss-100)" strokeWidth="0.8" />
      <line x1="28" y1="16" x2="28" y2="36" stroke="var(--color-moss-100)" strokeWidth="0.8" />
      <line x1="12" y1="24" x2="36" y2="24" stroke="var(--color-moss-100)" strokeWidth="0.8" />
      <circle cx="16" cy="20" r="2.5" fill="var(--color-marigold-500)" stroke="var(--color-marigold-700)" strokeWidth="0.8" />
      <circle cx="32" cy="32" r="2.5" fill="var(--color-moss-500)" stroke="var(--color-moss-700)" strokeWidth="0.8" />
      <circle cx="24" cy="26" r="2" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="0.8" />
    </svg>
  );
}

export function IllusLegal({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M6 10 L24 8 L42 10 L42 40 L24 38 L6 40 Z" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <line x1="24" y1="8" x2="24" y2="38" stroke="var(--color-moss-500)" strokeWidth="1" />
      <line x1="9" y1="16" x2="21" y2="16" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="9" y1="20" x2="21" y2="20" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="9" y1="24" x2="18" y2="24" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="27" y1="16" x2="39" y2="16" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="27" y1="20" x2="39" y2="20" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="27" y1="24" x2="35" y2="24" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <path d="M32 10 C38 6 42 4 40 14 C36 12 34 16 32 18" fill="var(--color-marigold-100)" stroke="var(--color-marigold-500)" strokeWidth="1" />
      <line x1="36" y1="14" x2="32" y2="28" stroke="var(--color-moss-700)" strokeWidth="0.8" />
    </svg>
  );
}

export function IllusAccommodation({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="6" y="24" width="36" height="18" rx="2" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="6" y="18" width="36" height="8" rx="2" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="10" y="26" width="10" height="7" rx="3" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <rect x="28" y="26" width="10" height="7" rx="3" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <rect x="8" y="33" width="32" height="7" rx="1" fill="var(--color-marigold-100)" stroke="var(--color-marigold-500)" strokeWidth="0.8" />
      <path d="M8 33 Q24 30 40 33" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <rect x="8" y="40" width="3" height="6" rx="1" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="0.8" />
      <rect x="37" y="40" width="3" height="6" rx="1" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="0.8" />
    </svg>
  );
}

// Slug-based lookup table for the Wedding Book hub. Falls through to
// `null` for slugs we don't have a scene illustration for (the hub
// then keeps the existing emoji glyph).
export function bookSceneFor(slug: string) {
  switch (slug) {
    case "wedding-party": return IllusWeddingParty;
    case "venue": return IllusVenue;
    case "food-drink": return IllusFood;
    case "photography": return IllusPhotography;
    case "guest-experience": return IllusGuestExp;
    case "legal-admin": return IllusLegal;
    case "accommodation": return IllusAccommodation;
    default: return null;
  }
}

// ── Empty-state illustrations (120×100) ─────────────────────────────────────

export function EmptyTasks() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="10" y="72" width="100" height="12" rx="3" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <rect x="18" y="84" width="6" height="14" rx="2" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="1" />
      <rect x="96" y="84" width="6" height="14" rx="2" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="1" />
      <rect x="35" y="20" width="50" height="54" rx="3" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="35" y="20" width="50" height="8" rx="3" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="41" y="34" width="6" height="6" rx="1" fill="var(--color-moss-50)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="51" y1="37" x2="68" y2="37" stroke="var(--color-moss-300)" strokeWidth="1" />
      <rect x="41" y="46" width="6" height="6" rx="1" fill="var(--color-moss-50)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="51" y1="49" x2="66" y2="49" stroke="var(--color-moss-300)" strokeWidth="1" />
      <rect x="41" y="58" width="6" height="6" rx="1" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="0.8" />
      <path d="M42.5 61 L44 63 L46.5 59" stroke="var(--color-moss-500)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="51" y1="61" x2="72" y2="61" stroke="var(--color-moss-300)" strokeWidth="1" />
    </svg>
  );
}

export function EmptyGuests() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M20 70 L20 40 Q60 25 100 40 L100 70 Z" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <path d="M20 40 Q60 55 100 40" fill="var(--color-moss-50)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <path d="M30 68 L30 45 L60 35" stroke="var(--color-moss-300)" strokeWidth="0.8" fill="none" />
      <path d="M90 68 L90 45 L60 35" stroke="var(--color-moss-300)" strokeWidth="0.8" fill="none" />
      <line x1="40" y1="58" x2="80" y2="58" stroke="var(--color-moss-300)" strokeWidth="1" />
      <line x1="48" y1="64" x2="72" y2="64" stroke="var(--color-moss-100)" strokeWidth="0.8" />
      <circle cx="60" cy="45" r="3" fill="var(--color-marigold-100)" stroke="var(--color-marigold-500)" strokeWidth="0.8" />
      <circle cx="55" cy="47" r="2" fill="var(--color-moss-100)" stroke="var(--color-moss-300)" strokeWidth="0.6" />
      <circle cx="65" cy="47" r="2" fill="var(--color-moss-100)" stroke="var(--color-moss-300)" strokeWidth="0.6" />
    </svg>
  );
}

export function EmptySchedule() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="60" cy="58" r="28" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <circle cx="60" cy="58" r="22" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <rect x="56" y="28" width="8" height="6" rx="2" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="58" y="22" width="4" height="6" rx="1" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="1" />
      <line x1="60" y1="58" x2="60" y2="42" stroke="var(--color-moss-700)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="58" x2="72" y2="64" stroke="var(--color-moss-500)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="60" cy="58" r="2" fill="var(--color-moss-500)" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
        const angle = ((i * 30 - 90) * Math.PI) / 180;
        const r1 = 19;
        const r2 = 21;
        return (
          <line
            key={i}
            x1={60 + r1 * Math.cos(angle)}
            y1={58 + r1 * Math.sin(angle)}
            x2={60 + r2 * Math.cos(angle)}
            y2={58 + r2 * Math.sin(angle)}
            stroke="var(--color-moss-300)"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}

export function EmptySeating() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="60" cy="55" r="24" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <circle cx="60" cy="55" r="16" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = ((i * 45 - 90) * Math.PI) / 180;
        const r = 30;
        const cx = 60 + r * Math.cos(angle);
        const cy = 55 + r * Math.sin(angle);
        return (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx="5"
            ry="3.5"
            fill="var(--color-surface)"
            stroke="var(--color-moss-500)"
            strokeWidth="1"
            transform={`rotate(${i * 45}, ${cx}, ${cy})`}
          />
        );
      })}
    </svg>
  );
}

export function EmptyPayments() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="20" y="30" width="80" height="55" rx="4" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.5" />
      <path d="M20 34 L60 60 L100 34" stroke="var(--color-moss-500)" strokeWidth="1.2" fill="none" />
      <line x1="20" y1="85" x2="45" y2="62" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="100" y1="85" x2="75" y2="62" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <circle cx="60" cy="85" r="10" fill="var(--color-marigold-100)" stroke="var(--color-marigold-500)" strokeWidth="1.2" />
      <circle cx="60" cy="85" r="6" fill="var(--color-marigold-100)" stroke="var(--color-marigold-700)" strokeWidth="0.8" />
      <text x="60" y="89" textAnchor="middle" fontSize="8" fill="var(--color-marigold-700)" fontFamily="var(--font-display)">♡</text>
    </svg>
  );
}

export function EmptySearch() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="50" cy="45" r="22" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.8" />
      <circle cx="50" cy="45" r="15" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
      <line x1="66" y1="61" x2="90" y2="83" stroke="var(--color-moss-500)" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 45 C46 38 52 36 54 42 C52 48 46 48 46 45Z" fill="var(--color-moss-300)" stroke="var(--color-moss-500)" strokeWidth="0.8" />
      <path d="M54 45 C54 40 58 42 56 48 C52 50 52 46 54 45Z" fill="var(--color-moss-100)" stroke="var(--color-moss-300)" strokeWidth="0.6" />
    </svg>
  );
}

// ── Reusable empty-state shell ──────────────────────────────────────────────
//
// Lets call sites do `<EmptyState illustration={EmptyTasks} title="…" body="…" />`
// without re-implementing the layout each time. The shipped empty states
// today are mostly bare `<p>No items yet.</p>` text — wrapping in this
// shell upgrades the at-rest visual without disturbing the content shape.

export function EmptyState({
  illustration: Illustration,
  title,
  body,
  action,
}: {
  illustration: () => React.JSX.Element;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
      <Illustration />
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-ink-secondary">{title}</h3>
        {body && <p className="text-xs text-ink-tertiary max-w-xs">{body}</p>}
      </div>
      {action}
    </div>
  );
}
