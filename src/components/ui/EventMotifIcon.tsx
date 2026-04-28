// C11 (v1.14.0): schedule-event motif icons.
//
// Six 16px SVGs ported from prototype/illustrations.jsx. CSS-variable
// theming means they pick up dark mode automatically (production uses
// `--color-*` prefixed tokens; the prototype used un-prefixed). Heuristic
// matching on event title classifies into one of:
//   - ring (ceremony / vows)
//   - candle (drinks reception, evening)
//   - plate (food, breakfast, buffet)
//   - camera (photos, portraits)
//   - bouquet (flowers, decor)
//   - suitcase (arrival, check-in, accommodation)
// Falls through to no icon when nothing matches — better than guessing
// wrong on a custom event the user added.

const Ring = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <circle cx="8" cy="8" r="5" stroke="var(--color-moss-500)" strokeWidth="1.5" fill="var(--color-moss-100)" />
    <circle cx="8" cy="8" r="2.5" stroke="var(--color-moss-500)" strokeWidth="1" fill="var(--color-surface)" />
    <path d="M6 4.5 Q8 3 10 4.5" stroke="var(--color-marigold-500)" strokeWidth="1" fill="none" strokeLinecap="round" />
  </svg>
);

const Candle = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="6" y="6" width="4" height="8" rx="1" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
    <path d="M8 2 C8 2 9.5 4 8 6 C6.5 4 8 2 8 2Z" fill="var(--color-marigold-500)" stroke="var(--color-marigold-700)" strokeWidth="0.5" />
    <line x1="8" y1="6" x2="8" y2="7" stroke="var(--color-moss-700)" strokeWidth="1" />
  </svg>
);

const Plate = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <ellipse cx="8" cy="10" rx="5.5" ry="1.5" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
    <ellipse cx="8" cy="9.5" rx="3.5" ry="1" fill="var(--color-surface)" stroke="var(--color-moss-300)" strokeWidth="0.8" />
    <path d="M6 7 C6 4 10 4 10 7" stroke="var(--color-moss-500)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

const Camera = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="2" y="5" width="12" height="9" rx="2" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
    <circle cx="8" cy="9.5" r="2.5" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1" />
    <path d="M5.5 5 L6.5 3 H9.5 L10.5 5" stroke="var(--color-moss-500)" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="0.8" fill="var(--color-marigold-500)" />
  </svg>
);

const Bouquet = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M8 14 C8 14 5 10 5 7.5 C5 6 6.5 5 8 5 C9.5 5 11 6 11 7.5 C11 10 8 14 8 14Z" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
    <circle cx="8" cy="5" r="1.5" fill="var(--color-marigold-100)" stroke="var(--color-marigold-500)" strokeWidth="1" />
    <circle cx="5.5" cy="6" r="1.2" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1" />
    <circle cx="10.5" cy="6" r="1.2" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1" />
    <path d="M7 14 L9 14" stroke="var(--color-moss-700)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const Suitcase = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="2" y="6" width="12" height="9" rx="2" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
    <path d="M5.5 6 L5.5 4.5 C5.5 3.7 6.2 3 7 3 H9 C9.8 3 10.5 3.7 10.5 4.5 L10.5 6" stroke="var(--color-moss-500)" strokeWidth="1.2" fill="none" />
    <line x1="8" y1="6" x2="8" y2="15" stroke="var(--color-moss-300)" strokeWidth="0.8" />
    <line x1="2" y1="10.5" x2="14" y2="10.5" stroke="var(--color-moss-300)" strokeWidth="0.8" />
  </svg>
);

export type EventMotif = "ring" | "candle" | "plate" | "camera" | "bouquet" | "suitcase" | null;

// Pure heuristic — exported separately so unit tests can lock the
// title-to-motif contract without rendering React.
export function classifyEventMotif(title: string): EventMotif {
  const t = title.toLowerCase();
  // No `wedding` here — "Wedding Breakfast" should be plate, not ring.
  // Ring is reserved for the explicit ceremony/vow/ring keywords.
  if (/\b(ceremony|vow|ring\b)/.test(t)) return "ring";
  if (/\b(arrival|check[- ]?in|accommodation|suite)\b/.test(t)) return "suitcase";
  // No trailing \b on the stem — matches singular and plural ("photo",
  // "photos", "portrait", "portraits") without listing each form.
  if (/\b(photo|portrait|shoot|camera)/.test(t)) return "camera";
  if (/\b(flower|bouquet|décor|decor)\b/.test(t)) return "bouquet";
  if (/\b(breakfast|dinner|buffet|food|meal|cake|drink|reception|toast)\b/.test(t)) {
    // "drinks reception" is a candle moment; everything else with food
    // wording is a plate.
    if (/\b(drinks|reception|toast|first dance)\b/.test(t)) return "candle";
    return "plate";
  }
  if (/\b(speeches|first dance|dance|evening)\b/.test(t)) return "candle";
  return null;
}

export function EventMotifIcon({ motif, size = 16 }: { motif: EventMotif; size?: number }) {
  if (!motif) return null;
  switch (motif) {
    case "ring": return <Ring size={size} />;
    case "candle": return <Candle size={size} />;
    case "plate": return <Plate size={size} />;
    case "camera": return <Camera size={size} />;
    case "bouquet": return <Bouquet size={size} />;
    case "suitcase": return <Suitcase size={size} />;
  }
}
