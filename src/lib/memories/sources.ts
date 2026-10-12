// v2.17.0: the raw, serialisable inputs to the Memory Book.
//
// `load.ts` fills this from Prisma; `assemble.ts` and `journey.ts` are
// pure functions over it. Dates are ISO strings, money is pounds as a
// number, HTML has already been decoded to text. Keeping the DB read
// and the assembly apart is what lets the chapter logic be unit-tested
// with fixtures and no database.

import type { Doc } from "@/lib/book-card-doc";

export type SrcSettings = {
  weddingDate: string;
  ceremonyTime: string;
  venue: string;
  venueAddress: string | null;
  coupleLabel: string;
  coupleShort: string;
  brideFirst: string;
  groomFirst: string;
};

export type SrcGuest = {
  id: string;
  firstName: string;
  lastName: string;
  rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  isChild: boolean;
  needsHighchair: boolean;
  side: "BRIDE" | "GROOM" | "BOTH";
  role: string | null;
  dietary: string[];
  mealStarter: string | null;
  mealMain: string | null;
  mealDessert: string | null;
  householdId: string;
  householdName: string;
  groups: string[];
  isPlusOne: boolean;
  createdAt: string;
  seatTableName: string | null;
  songRequests: Array<{ title: string; artist: string | null; createdAt: string }>;
};

export type SrcTable = {
  id: string;
  name: string;
  shape: string;
  capacity: number;
  seats: Array<{ index: number; guestName: string | null }>;
};

export type SrcTask = {
  id: string;
  title: string;
  type: "TASK" | "QUESTION" | "DECISION";
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "DONE" | "ARCHIVED";
  decisionAnswer: string | null;
  questionAnswer: string | null;
  notes: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  supplierName: string | null;
  sectionSlugs: string[];
};

export type SrcEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  allDay: boolean;
  printable: boolean;
  order: number;
};

export type SrcSupplier = {
  id: string;
  name: string;
  category: string;
  status: "SHORTLIST" | "CONTACTED" | "QUOTED" | "BOOKED" | "PAID" | "REJECTED";
  website: string | null;
  notes: string | null;
  amountAgreed: number | null;
  createdAt: string;
  contacts: Array<{ name: string; role: string | null; primary: boolean }>;
  contracts: Array<{ signedAt: string | null; signed: boolean }>;
  communications: Array<{ channel: string; summary: string; createdAt: string }>;
};

export type SrcPayment = {
  id: string;
  description: string;
  amount: number;
  status: "DUE" | "SCHEDULED" | "PAID" | "OVERDUE" | "CANCELLED";
  dueDate: string | null;
  paidDate: string | null;
  method: string | null;
  supplierName: string | null;
  notes: string | null;
  createdAt: string;
};

export type SrcBudget = {
  categories: Array<{ name: string; estimated: number; actual: number; paid: number }>;
  totals: { estimated: number; actual: number; paid: number };
};

export type SrcPlaylist = {
  id: string;
  name: string;
  category: string;
  isBlockList: boolean;
  songs: Array<{ title: string; artist: string | null; createdAt: string }>;
};

export type SrcBookCard = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  doc: Doc;
  /** SHOT_LIST only. */
  shots?: { total: number; captured: number };
};

export type SrcBookSection = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  order: number;
  createdAt: string;
  cards: SrcBookCard[];
};

export type SrcFile = { id: string; name: string; mimeType: string; folder: string | null; createdAt: string };

export type SrcAiThread = {
  id: string;
  title: string | null;
  createdAt: string;
  /** The first real exchange in the thread (both sides non-empty), clipped. */
  exchange: { user: string; assistant: string } | null;
};

export type MemorySources = {
  settings: SrcSettings;
  guests: SrcGuest[];
  tables: SrcTable[];
  tasks: SrcTask[];
  events: SrcEvent[];
  suppliers: SrcSupplier[];
  payments: SrcPayment[];
  budget: SrcBudget | null;
  playlists: SrcPlaylist[];
  book: SrcBookSection[];
  files: SrcFile[];
  aiThreads: SrcAiThread[];
};
