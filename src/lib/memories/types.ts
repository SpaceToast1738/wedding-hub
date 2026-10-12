// v2.17.0: the Memory Book data model.
//
// One serialisable `MemoryBookData` is built server-side from everything
// the couple planned (settings, guests, seating, schedule, suppliers,
// payments, budget, songs, the Wedding Book, decisions, the AI threads)
// and the same tree then renders on screen, on paper and — later — into
// the frozen export. Nothing here imports Prisma or React: the shapes
// are plain JSON so they can be cached, diffed and unit-tested.
//
// Money: anything that carries a cost is flagged `money: true` at the
// block, item or chapter level. `redactMoney()` strips those, so the
// default view (and the print) never shows a number unless the couple
// switches it on.

import type { Block, Doc } from "@/lib/book-card-doc";

export type ChapterPart = "before" | "day" | "after";

export const PARTS: Array<{ key: ChapterPart; title: string; subtitle: string }> = [
  { key: "before", title: "Before", subtitle: "Everything we planned" },
  { key: "day", title: "The day", subtitle: "Hour by hour" },
  { key: "after", title: "After", subtitle: "The honeymoon, the paperwork, the memories" },
];

export type PhotoAspect = "wide" | "square" | "portrait";

export type PhotoSlot = {
  slot: string;
  label: string;
  aspect: PhotoAspect;
  /** null = placeholder. Filled in a later version (uploads / OneDrive). */
  photo: null | { id: string; caption: string | null; src: string };
};

export type StatItem = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  /** Visually dominant tile. */
  hero?: boolean;
  money?: true;
};

export type TimelineHighlight = {
  kind: "decision" | "question" | "booked" | "paid" | "milestone" | "event";
  text: string;
  /** Date derived from `updatedAt` rather than a real timestamp. */
  approx: boolean;
  money?: true;
};

export type TimelineMonth = {
  /** "2026-08" */
  month: string;
  /** "August 2026" */
  label: string;
  counts: {
    tasksCreated: number;
    tasksDone: number;
    decisions: number;
    questionsAnswered: number;
    suppliersBooked: number;
    paymentsPaid: number;
    guestsAdded: number;
    filesUploaded: number;
    songsAdded: number;
  };
  highlights: TimelineHighlight[];
  /** Titles of tasks completed (approx: last-touched) in this month. */
  tasksDone: string[];
};

export type CardItem = {
  kicker?: string;
  title: string;
  body: string;
  /** Optional bullet lines under the body. */
  lines?: string[];
  href?: string;
  money?: true;
};

export type MemoryBlock =
  | Block
  | { kind: "stats"; items: StatItem[]; money?: true }
  | { kind: "timeline"; months: TimelineMonth[] }
  | {
      kind: "doc";
      doc: Doc;
      source: { sectionSlug: string; cardSlug: string; cardKind: string; cardTitle: string };
      money?: true;
    }
  | { kind: "names"; columns: Array<{ label: string; names: string[] }> }
  | {
      kind: "seating";
      tables: Array<{ name: string; shape: string; seats: Array<{ index: number; name: string | null }> }>;
    }
  | {
      kind: "events";
      items: Array<{ time: string; title: string; location: string | null; notes: string | null }>;
    }
  | { kind: "cards"; items: CardItem[]; columns?: 1 | 2 | 3; money?: true }
  | {
      kind: "moneyTable";
      rows: Array<{ label: string; estimated: number; actual: number; paid: number }>;
      total: { estimated: number; actual: number; paid: number };
      money: true;
    }
  | { kind: "chat"; exchanges: Array<{ when: string; user: string; assistant: string }> }
  | { kind: "empty"; text: string };

export type MemoryChapter = {
  key: string;
  part: ChapterPart;
  /** 1-based, across all parts. */
  number: number;
  title: string;
  kicker?: string;
  intro?: string;
  photos: PhotoSlot[];
  blocks: MemoryBlock[];
  /** Whole chapter is money: dropped by redactMoney. */
  money?: true;
};

export type MemoryBookData = {
  generatedAt: string;
  appVersion: string;
  wedding: {
    coupleShort: string;
    coupleLabel: string;
    brideFirst: string;
    groomFirst: string;
    /** ISO date-time. */
    weddingDate: string;
    ceremonyTime: string;
    venue: string;
    venueAddress: string | null;
  };
  planning: {
    firstRecordAt: string | null;
    daysOfPlanning: number | null;
  };
  chapters: MemoryChapter[];
  moneyIncluded: boolean;
};
