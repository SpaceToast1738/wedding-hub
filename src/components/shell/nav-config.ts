export type NavItem = {
  href: string;
  label: string;
  icon: string;
  countKey?: keyof Counts;
  coupleOnly?: boolean;
};

export type NavGroup = { id: string; items: NavItem[] };

export type Counts = {
  tasks: number;
  questions: number;
  guests: number;
  payments: number;
  files?: number;
  // v2.5.0: pending AI proposal count — same count-pill convention as
  // tasks/questions/guests. Previously the AI planner had no nav entry
  // at all, so pending proposals were only discoverable from inside
  // the chat panel.
  aiProposals?: number;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "daily",
    items: [
      { href: "/",        label: "Today",       icon: "◉" },
      { href: "/glance",  label: "At a Glance", icon: "⊡" },
    ],
  },
  {
    id: "work",
    items: [
      { href: "/tasks",     label: "Tasks",     icon: "✓", countKey: "tasks" },
      { href: "/questions", label: "Questions & Decisions", icon: "?", countKey: "questions" },
      { href: "/schedule",  label: "Schedule",  icon: "◷" },
      { href: "/suppliers", label: "Suppliers", icon: "◈" },
      // v2.5.0: the AI planner had no entry point outside the chat
      // panel — pending proposals were completely undiscoverable from
      // the shell. countKey wires it into the same badge convention
      // as Tasks/Questions/Guests.
      { href: "/ai",        label: "AI planner", icon: "✨", countKey: "aiProposals" },
    ],
  },
  {
    id: "people",
    items: [
      { href: "/guests",  label: "Guests",       icon: "◎", countKey: "guests" },
      { href: "/seating", label: "Seating",      icon: "⊛" },
      { href: "/songs",   label: "Songs",        icon: "♪" },
      { href: "/book",    label: "Wedding Book", icon: "◧" },
      { href: "/diy",     label: "DIY",          icon: "✂" },
    ],
  },
  {
    id: "money",
    items: [
      { href: "/budget",   label: "Budget",   icon: "◫", coupleOnly: true },
      { href: "/payments", label: "Payments", icon: "◻", coupleOnly: true, countKey: "payments" },
    ],
  },
  {
    id: "docs",
    items: [
      { href: "/files", label: "Files", icon: "◰", countKey: "files" },
    ],
  },
];

// v2.4.3: Suppliers promoted to a real tab — it was two taps away
// inside the flat "More" sheet, which was the main "awkward to get
// to" complaint. Five tabs still fit comfortably at 320px.
export const MOBILE_TABS: { href: string; label: string; icon: string; isMore?: boolean }[] = [
  { href: "/",          label: "Today",     icon: "◉" },
  { href: "/tasks",     label: "Tasks",     icon: "✓" },
  { href: "/guests",    label: "Guests",    icon: "◎" },
  { href: "/suppliers", label: "Suppliers", icon: "◈" },
  { href: "/menu",      label: "More",      icon: "···", isMore: true },
];
