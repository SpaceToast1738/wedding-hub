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

export const MOBILE_TABS: { href: string; label: string; icon: string; isMore?: boolean }[] = [
  { href: "/",       label: "Today",  icon: "◉" },
  { href: "/tasks",  label: "Tasks",  icon: "✓" },
  { href: "/guests", label: "Guests", icon: "◎" },
  { href: "/menu",   label: "More",   icon: "···", isMore: true },
];
