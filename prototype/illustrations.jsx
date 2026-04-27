/* Wedding Hub — SVG Illustrations
   All illustrations use CSS variables so they work in both light and dark mode.
   Line: moss-500, Fill: moss-100, Accent: marigold-500
*/

// ── Schedule event dots (16px) ──────────────────────────────────────────────

const IcoRing = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="5" stroke="var(--moss-500)" strokeWidth="1.5" fill="var(--moss-100)"/>
    <circle cx="8" cy="8" r="2.5" stroke="var(--moss-500)" strokeWidth="1" fill="var(--bg-surface)"/>
    <path d="M6 4.5 Q8 3 10 4.5" stroke="var(--marigold-500)" strokeWidth="1" fill="none" strokeLinecap="round"/>
  </svg>
);

const IcoCandle = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="4" height="8" rx="1" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <path d="M8 2 C8 2 9.5 4 8 6 C6.5 4 8 2 8 2Z" fill="var(--marigold-500)" stroke="var(--marigold-700)" strokeWidth="0.5"/>
    <line x1="8" y1="6" x2="8" y2="7" stroke="var(--moss-700)" strokeWidth="1"/>
  </svg>
);

const IcoPlate = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="8" cy="10" rx="5.5" ry="1.5" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <ellipse cx="8" cy="9.5" rx="3.5" ry="1" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <path d="M6 7 C6 4 10 4 10 7" stroke="var(--moss-500)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
  </svg>
);

const IcoCamera = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="5" width="12" height="9" rx="2" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <circle cx="8" cy="9.5" r="2.5" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1"/>
    <path d="M5.5 5 L6.5 3 H9.5 L10.5 5" stroke="var(--moss-500)" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
    <circle cx="12" cy="7" r="0.8" fill="var(--marigold-500)"/>
  </svg>
);

const IcoBouquet = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 14 C8 14 5 10 5 7.5 C5 6 6.5 5 8 5 C9.5 5 11 6 11 7.5 C11 10 8 14 8 14Z" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <circle cx="8" cy="5" r="1.5" fill="var(--marigold-100)" stroke="var(--marigold-500)" strokeWidth="1"/>
    <circle cx="5.5" cy="6" r="1.2" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1"/>
    <circle cx="10.5" cy="6" r="1.2" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1"/>
    <path d="M7 14 L9 14" stroke="var(--moss-700)" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IcoSuitcase = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="12" height="9" rx="2" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <path d="M5.5 6 L5.5 4.5 C5.5 3.7 6.2 3 7 3 H9 C9.8 3 10.5 3.7 10.5 4.5 L10.5 6" stroke="var(--moss-500)" strokeWidth="1.2" fill="none"/>
    <line x1="8" y1="6" x2="8" y2="15" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="2" y1="10.5" x2="14" y2="10.5" stroke="var(--moss-300)" strokeWidth="0.8"/>
  </svg>
);

// ── Full scene illustrations ──────────────────────────────────────────────

const IllusCountdown = ({ width = 240, height = 140 }) => (
  <svg width={width} height={height} viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{opacity:0.18, position:'absolute', top:0, right:0}}>
    {/* Large leaf top-right */}
    <path d="M220 10 C200 30 190 60 200 80 C210 60 230 35 220 10Z" fill="var(--moss-500)" stroke="var(--moss-700)" strokeWidth="1"/>
    <path d="M220 10 L200 80" stroke="var(--moss-700)" strokeWidth="0.8"/>
    {/* Small leaf */}
    <path d="M195 20 C180 35 178 55 188 65 C192 50 200 28 195 20Z" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="0.8"/>
    <path d="M195 20 L188 65" stroke="var(--moss-500)" strokeWidth="0.6"/>
    {/* Candle bottom */}
    <rect x="110" y="90" width="12" height="32" rx="2" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1"/>
    <path d="M116 82 C116 82 120 88 116 92 C112 88 116 82 116 82Z" fill="var(--marigold-500)" stroke="var(--marigold-700)" strokeWidth="0.8"/>
    <line x1="100" y1="122" x2="132" y2="122" stroke="var(--moss-500)" strokeWidth="1"/>
    {/* Ribbon */}
    <path d="M60 100 C70 90 80 110 90 100 C100 90 110 110 120 100" stroke="var(--marigold-500)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </svg>
);

const IllusWeddingParty = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="18" r="8" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <path d="M18 18 C18 14 21 12 24 12 C27 12 30 14 30 18" stroke="var(--moss-500)" strokeWidth="1" fill="none"/>
    <path d="M16 34 C16 28 20 25 24 25 C28 25 32 28 32 34" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <path d="M8 22 C10 18 13 19 14 22" stroke="var(--moss-300)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <path d="M40 22 C38 18 35 19 34 22" stroke="var(--moss-300)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <circle cx="12" cy="22" r="3" fill="var(--moss-50)" stroke="var(--moss-300)" strokeWidth="1"/>
    <circle cx="36" cy="22" r="3" fill="var(--moss-50)" stroke="var(--moss-300)" strokeWidth="1"/>
    {/* Bouquet */}
    <circle cx="24" cy="38" r="4" fill="var(--marigold-100)" stroke="var(--marigold-500)" strokeWidth="1"/>
    <circle cx="20" cy="40" r="2.5" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="0.8"/>
    <circle cx="28" cy="40" r="2.5" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="0.8"/>
  </svg>
);

const IllusVenue = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="20" width="32" height="24" rx="1" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <path d="M8 20 C8 20 24 8 40 20" fill="var(--moss-50)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    {/* Arch door */}
    <path d="M18 44 L18 32 C18 28 30 28 30 32 L30 44" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    {/* Windows */}
    <rect x="10" y="26" width="6" height="7" rx="1" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <rect x="32" y="26" width="6" height="7" rx="1" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    {/* Ivy */}
    <path d="M8 24 C6 22 4 26 6 28" stroke="var(--moss-500)" strokeWidth="0.8" fill="none"/>
    <ellipse cx="5" cy="24" rx="2" ry="1.5" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="0.6"/>
  </svg>
);

const IllusFood = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Cake stand */}
    <ellipse cx="24" cy="40" rx="14" ry="3" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <rect x="22" y="30" width="4" height="10" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1"/>
    {/* Cake tiers */}
    <rect x="12" y="28" width="24" height="10" rx="3" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <rect x="16" y="18" width="16" height="10" rx="3" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <rect x="20" y="10" width="8" height="8" rx="2" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    {/* Decorations */}
    <circle cx="24" cy="10" r="1.5" fill="var(--marigold-500)"/>
    <path d="M12 33 C16 30 20 36 24 33 C28 30 32 36 36 33" stroke="var(--moss-300)" strokeWidth="0.8" fill="none"/>
    <path d="M16 23 C19 21 21 25 24 23 C27 21 29 25 32 23" stroke="var(--moss-300)" strokeWidth="0.8" fill="none"/>
  </svg>
);

const IllusPhotography = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="14" width="40" height="28" rx="4" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <circle cx="24" cy="28" r="8" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <circle cx="24" cy="28" r="4.5" fill="var(--moss-50)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <path d="M16 14 L18 10 H30 L32 14" stroke="var(--moss-500)" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
    <circle cx="36" cy="20" r="2" fill="var(--marigold-500)"/>
    {/* Leaf aperture */}
    <path d="M24 20 C28 22 28 34 24 36" stroke="var(--moss-500)" strokeWidth="0.7" fill="none"/>
    <path d="M24 20 C20 22 20 34 24 36" stroke="var(--moss-500)" strokeWidth="0.7" fill="none"/>
  </svg>
);

const IllusGuestExp = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Board game pieces */}
    <rect x="8" y="12" width="32" height="28" rx="3" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <rect x="12" y="16" width="24" height="20" rx="2" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    {/* Game board grid */}
    <line x1="20" y1="16" x2="20" y2="36" stroke="var(--moss-100)" strokeWidth="0.8"/>
    <line x1="28" y1="16" x2="28" y2="36" stroke="var(--moss-100)" strokeWidth="0.8"/>
    <line x1="12" y1="24" x2="36" y2="24" stroke="var(--moss-100)" strokeWidth="0.8"/>
    {/* Pieces */}
    <circle cx="16" cy="20" r="2.5" fill="var(--marigold-500)" stroke="var(--marigold-700)" strokeWidth="0.8"/>
    <circle cx="32" cy="32" r="2.5" fill="var(--moss-500)" stroke="var(--moss-700)" strokeWidth="0.8"/>
    <circle cx="24" cy="26" r="2" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="0.8"/>
  </svg>
);

const IllusLegal = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Open ledger */}
    <path d="M6 10 L24 8 L42 10 L42 40 L24 38 L6 40 Z" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <line x1="24" y1="8" x2="24" y2="38" stroke="var(--moss-500)" strokeWidth="1"/>
    {/* Lines on pages */}
    <line x1="9" y1="16" x2="21" y2="16" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="9" y1="20" x2="21" y2="20" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="9" y1="24" x2="18" y2="24" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="27" y1="16" x2="39" y2="16" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="27" y1="20" x2="39" y2="20" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="27" y1="24" x2="35" y2="24" stroke="var(--moss-300)" strokeWidth="0.8"/>
    {/* Quill */}
    <path d="M32 10 C38 6 42 4 40 14 C36 12 34 16 32 18" fill="var(--marigold-100)" stroke="var(--marigold-500)" strokeWidth="1"/>
    <line x1="36" y1="14" x2="32" y2="28" stroke="var(--moss-700)" strokeWidth="0.8"/>
  </svg>
);

const IllusAccommodation = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bed frame */}
    <rect x="6" y="24" width="36" height="18" rx="2" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    {/* Headboard */}
    <rect x="6" y="18" width="36" height="8" rx="2" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    {/* Pillow */}
    <rect x="10" y="26" width="10" height="7" rx="3" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <rect x="28" y="26" width="10" height="7" rx="3" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    {/* Blanket/throw with fold */}
    <rect x="8" y="33" width="32" height="7" rx="1" fill="var(--marigold-100)" stroke="var(--marigold-500)" strokeWidth="0.8"/>
    <path d="M8 33 Q24 30 40 33" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    {/* Legs */}
    <rect x="8" y="40" width="3" height="6" rx="1" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="0.8"/>
    <rect x="37" y="40" width="3" height="6" rx="1" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="0.8"/>
  </svg>
);

// ── Empty state illustrations ──────────────────────────────────────────────

const EmptyTasks = () => (
  <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Wooden table */}
    <rect x="10" y="72" width="100" height="12" rx="3" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <rect x="18" y="84" width="6" height="14" rx="2" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="1"/>
    <rect x="96" y="84" width="6" height="14" rx="2" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="1"/>
    {/* Checklist paper */}
    <rect x="35" y="20" width="50" height="54" rx="3" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <rect x="35" y="20" width="50" height="8" rx="3" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    {/* Check lines */}
    <rect x="41" y="34" width="6" height="6" rx="1" fill="var(--moss-50)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="51" y1="37" x2="68" y2="37" stroke="var(--moss-300)" strokeWidth="1"/>
    <rect x="41" y="46" width="6" height="6" rx="1" fill="var(--moss-50)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="51" y1="49" x2="66" y2="49" stroke="var(--moss-300)" strokeWidth="1"/>
    <rect x="41" y="58" width="6" height="6" rx="1" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="0.8"/>
    <path d="M42.5 61 L44 63 L46.5 59" stroke="var(--moss-500)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="51" y1="61" x2="72" y2="61" stroke="var(--moss-300)" strokeWidth="1"/>
  </svg>
);

const EmptyGuests = () => (
  <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Place card */}
    <path d="M20 70 L20 40 Q60 25 100 40 L100 70 Z" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <path d="M20 40 Q60 55 100 40" fill="var(--moss-50)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    {/* Folded tent card */}
    <path d="M30 68 L30 45 L60 35" stroke="var(--moss-300)" strokeWidth="0.8" fill="none"/>
    <path d="M90 68 L90 45 L60 35" stroke="var(--moss-300)" strokeWidth="0.8" fill="none"/>
    {/* Name line */}
    <line x1="40" y1="58" x2="80" y2="58" stroke="var(--moss-300)" strokeWidth="1"/>
    <line x1="48" y1="64" x2="72" y2="64" stroke="var(--moss-100)" strokeWidth="0.8"/>
    {/* Small flower accent */}
    <circle cx="60" cy="45" r="3" fill="var(--marigold-100)" stroke="var(--marigold-500)" strokeWidth="0.8"/>
    <circle cx="55" cy="47" r="2" fill="var(--moss-100)" stroke="var(--moss-300)" strokeWidth="0.6"/>
    <circle cx="65" cy="47" r="2" fill="var(--moss-100)" stroke="var(--moss-300)" strokeWidth="0.6"/>
  </svg>
);

const EmptySchedule = () => (
  <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Pocket watch */}
    <circle cx="60" cy="58" r="28" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <circle cx="60" cy="58" r="22" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    {/* Crown */}
    <rect x="56" y="28" width="8" height="6" rx="2" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.2"/>
    <rect x="58" y="22" width="4" height="6" rx="1" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="1"/>
    {/* Hands */}
    <line x1="60" y1="58" x2="60" y2="42" stroke="var(--moss-700)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="60" y1="58" x2="72" y2="64" stroke="var(--moss-500)" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="60" cy="58" r="2" fill="var(--moss-500)"/>
    {/* Hour marks */}
    {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
      const angle = (i * 30 - 90) * Math.PI / 180;
      const r1 = 19, r2 = 21;
      return <line key={i} x1={60+r1*Math.cos(angle)} y1={58+r1*Math.sin(angle)} x2={60+r2*Math.cos(angle)} y2={58+r2*Math.sin(angle)} stroke="var(--moss-300)" strokeWidth="1"/>;
    })}
  </svg>
);

const EmptySeating = () => (
  <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Round table */}
    <circle cx="60" cy="55" r="24" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <circle cx="60" cy="55" r="16" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    {/* Chairs around */}
    {[0,1,2,3,4,5,6,7].map(i => {
      const angle = (i * 45 - 90) * Math.PI / 180;
      const r = 30;
      const cx = 60 + r * Math.cos(angle);
      const cy = 55 + r * Math.sin(angle);
      return <ellipse key={i} cx={cx} cy={cy} rx="5" ry="3.5" fill="var(--bg-surface)" stroke="var(--moss-500)" strokeWidth="1" transform={`rotate(${i*45}, ${cx}, ${cy})`}/>;
    })}
  </svg>
);

const EmptyPayments = () => (
  <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Envelope */}
    <rect x="20" y="30" width="80" height="55" rx="4" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.5"/>
    <path d="M20 34 L60 60 L100 34" stroke="var(--moss-500)" strokeWidth="1.2" fill="none"/>
    <line x1="20" y1="85" x2="45" y2="62" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="100" y1="85" x2="75" y2="62" stroke="var(--moss-300)" strokeWidth="0.8"/>
    {/* Wax seal */}
    <circle cx="60" cy="85" r="10" fill="var(--marigold-100)" stroke="var(--marigold-500)" strokeWidth="1.2"/>
    <circle cx="60" cy="85" r="6" fill="var(--marigold-100)" stroke="var(--marigold-700)" strokeWidth="0.8"/>
    <text x="60" y="89" textAnchor="middle" fontSize="8" fill="var(--marigold-700)" fontFamily="var(--font-display)">♡</text>
  </svg>
);

const EmptySearch = () => (
  <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Magnifying glass */}
    <circle cx="50" cy="45" r="22" fill="var(--moss-100)" stroke="var(--moss-500)" strokeWidth="1.8"/>
    <circle cx="50" cy="45" r="15" fill="var(--bg-surface)" stroke="var(--moss-300)" strokeWidth="0.8"/>
    <line x1="66" y1="61" x2="90" y2="83" stroke="var(--moss-500)" strokeWidth="3" strokeLinecap="round"/>
    {/* Leaves inside */}
    <path d="M46 45 C46 38 52 36 54 42 C52 48 46 48 46 45Z" fill="var(--moss-300)" stroke="var(--moss-500)" strokeWidth="0.8"/>
    <path d="M54 45 C54 40 58 42 56 48 C52 50 52 46 54 45Z" fill="var(--moss-100)" stroke="var(--moss-300)" strokeWidth="0.6"/>
  </svg>
);

Object.assign(window, {
  IcoRing, IcoCandle, IcoPlate, IcoCamera, IcoBouquet, IcoSuitcase,
  IllusCountdown, IllusWeddingParty, IllusVenue, IllusFood,
  IllusPhotography, IllusGuestExp, IllusLegal, IllusAccommodation,
  EmptyTasks, EmptyGuests, EmptySchedule, EmptySeating, EmptyPayments, EmptySearch
});
