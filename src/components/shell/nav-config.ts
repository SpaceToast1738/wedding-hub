import {
  Home,
  LayoutDashboard,
  ListChecks,
  HelpCircle,
  Clock,
  Building2,
  Sparkles,
  Users,
  Armchair,
  Music,
  BookOpen,
  Scissors,
  Wallet,
  CreditCard,
  FolderOpen,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
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

// v2.6.10 (icon migration Phase 4): icons were bare Unicode geometric
// glyphs (◉⊡✓?◷◈✨◎⊛♪◧✂◫◻◰···) — replaced with lucide-react
// components. Consumers (SidebarItem.tsx, MobileTabBar.tsx) keep their
// own existing per-context sizing; only the token type changed.
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "daily",
    items: [
      { href: "/",        label: "Today",       icon: Home },
      { href: "/glance",  label: "At a Glance", icon: LayoutDashboard },
    ],
  },
  {
    id: "work",
    items: [
      { href: "/tasks",     label: "Tasks",     icon: ListChecks, countKey: "tasks" },
      { href: "/questions", label: "Questions & Decisions", icon: HelpCircle, countKey: "questions" },
      { href: "/schedule",  label: "Schedule",  icon: Clock },
      { href: "/suppliers", label: "Suppliers", icon: Building2 },
      // v2.5.0: the AI planner had no entry point outside the chat
      // panel — pending proposals were completely undiscoverable from
      // the shell. countKey wires it into the same badge convention
      // as Tasks/Questions/Guests.
      { href: "/ai",        label: "AI planner", icon: Sparkles, countKey: "aiProposals" },
    ],
  },
  {
    id: "people",
    items: [
      { href: "/guests",  label: "Guests",       icon: Users, countKey: "guests" },
      { href: "/seating", label: "Seating",      icon: Armchair },
      { href: "/songs",   label: "Songs",        icon: Music },
      { href: "/book",    label: "Wedding Book", icon: BookOpen },
      { href: "/diy",     label: "DIY",          icon: Scissors },
    ],
  },
  {
    id: "money",
    items: [
      { href: "/budget",   label: "Budget",   icon: Wallet, coupleOnly: true },
      { href: "/payments", label: "Payments", icon: CreditCard, coupleOnly: true, countKey: "payments" },
    ],
  },
  {
    id: "docs",
    items: [
      { href: "/files", label: "Files", icon: FolderOpen, countKey: "files" },
    ],
  },
];

// v2.4.3: Suppliers promoted to a real tab — it was two taps away
// inside the flat "More" sheet, which was the main "awkward to get
// to" complaint. Five tabs still fit comfortably at 320px.
export const MOBILE_TABS: { href: string; label: string; icon: LucideIcon; isMore?: boolean }[] = [
  { href: "/",          label: "Today",     icon: Home },
  { href: "/tasks",     label: "Tasks",     icon: ListChecks },
  { href: "/guests",    label: "Guests",    icon: Users },
  { href: "/suppliers", label: "Suppliers", icon: Building2 },
  { href: "/menu",      label: "More",      icon: MoreHorizontal, isMore: true },
];
