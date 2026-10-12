// v2.17.0: MemorySources → MemoryBookData. Pure.
//
// Three parts, numbered chapters. Wedding Book sections are absorbed
// into the chapter that suits them (clothing → "The look", food-drink →
// "Food and drink", …); anything unmapped becomes its own chapter so
// nothing in the Book is left out. Money-bearing blocks are flagged and
// stripped by redact.ts unless the couple switches them on.

import type { Block } from "@/lib/book-card-doc";
import { deriveJourney, firstRecordAt } from "./journey";
import type { MemorySources, SrcBookCard, SrcBookSection, SrcGuest, SrcSupplier } from "./sources";
import type {
  CardItem,
  ChapterPart,
  MemoryBlock,
  MemoryBookData,
  MemoryChapter,
  PhotoAspect,
  PhotoSlot,
  StatItem,
} from "./types";

// ─── Formatting (UTC: the app stores wall-clock times as UTC) ───────────

const DATE_SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DATE_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });

export function fmtDate(iso: string | null | undefined): string {
  return iso ? DATE_SHORT.format(new Date(iso)) : "—";
}
export function fmtDateLong(iso: string): string {
  return DATE_LONG.format(new Date(iso));
}
export function fmtTime(iso: string): string {
  return TIME.format(new Date(iso)).toLowerCase().replace(" ", "");
}
function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}
function firstParagraph(s: string | null): string | null {
  if (!s) return null;
  const p = s.split(/\n\s*\n/)[0] ?? s;
  return clip(p, 420);
}
function para(text: string): Block {
  return { kind: "paragraph", spans: [{ text }] };
}
function slots(spec: Array<[string, PhotoAspect]>): PhotoSlot[] {
  return spec.map(([label, aspect], i) => ({ slot: `s${i + 1}`, label, aspect, photo: null }));
}
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}
function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ─── Book section → chapter mapping ────────────────────────────────────

export const SECTION_CHAPTER: Record<string, string> = {
  clothing: "look",
  "venue-decor": "decor",
  "food-drink": "food",
  "guest-experience": "games",
  legal: "legal",
  accommodation: "eve",
  "ceremony-amp-music": "ceremony",
  photography: "photos",
  "post-wedding": "paperwork",
};

function docBlock(section: SrcBookSection, card: SrcBookCard): MemoryBlock {
  return {
    kind: "doc",
    doc: card.doc,
    source: { sectionSlug: section.slug, cardSlug: card.slug, cardKind: card.kind, cardTitle: card.title },
  };
}

function sectionDocs(src: MemorySources, slug: string, skip: (c: SrcBookCard) => boolean = () => false): MemoryBlock[] {
  const section = src.book.find((s) => s.slug === slug);
  if (!section) return [];
  return section.cards.filter((c) => !skip(c)).map((c) => docBlock(section, c));
}

// ─── Chapter builders ───────────────────────────────────────────────────

type Ctx = {
  src: MemorySources;
  weddingDay: string;
  attending: SrcGuest[];
  journeyStart: string | null;
  daysOfPlanning: number | null;
};

function chNumbers(ctx: Ctx): MemoryChapter {
  const { src, attending } = ctx;
  const live = src.tasks.filter((t) => t.status !== "ARCHIVED");
  const decisions = live.filter((t) => t.type === "DECISION" && t.status === "DONE").length;
  const questions = live.filter((t) => t.type === "QUESTION" && t.status === "DONE").length;
  const seats = src.tables.reduce((n, t) => n + t.seats.length, 0);
  const cards = src.book.reduce((n, s) => n + s.cards.length, 0);
  const songs = src.playlists.filter((p) => !p.isBlockList).reduce((n, p) => n + p.songs.length, 0);
  const requests = src.guests.reduce((n, g) => n + g.songRequests.length, 0);
  const items: StatItem[] = [];
  if (ctx.daysOfPlanning != null) items.push({ label: "days of planning", value: ctx.daysOfPlanning, hero: true });
  items.push(
    { label: "guests invited", value: src.guests.length },
    { label: `came · ${attending.filter((g) => g.isChild).length} of them children`, value: attending.length },
    { label: `tables, ${seats} seats`, value: src.tables.length },
    { label: "tasks, questions and decisions", value: live.length },
    { label: `decisions · ${questions} questions answered`, value: decisions },
    { label: `suppliers · ${src.payments.filter((p) => p.status === "PAID").length} payments`, value: src.suppliers.length },
    { label: `Wedding Book cards in ${src.book.length} sections`, value: cards },
    { label: `songs · ${requests} guest requests`, value: songs },
  );
  if (src.budget) {
    items.push({ label: "spent, all in", value: Math.round(src.budget.totals.actual), prefix: "£", money: true });
  }
  const from = ctx.journeyStart ? `From ${fmtDate(ctx.journeyStart)}` : "From the first record";
  return {
    key: "numbers",
    part: "before",
    number: 0,
    title: "By the numbers",
    kicker: "Chapter",
    intro: `${from} to ${fmtDateLong(src.settings.weddingDate)}.`,
    photos: slots([["A planning photo", "square"], ["Another", "square"]]),
    blocks: [{ kind: "stats", items }],
  };
}

function chJourney(ctx: Ctx): MemoryChapter {
  return {
    key: "journey",
    part: "before",
    number: 0,
    title: "How it came together",
    intro:
      "Month by month: every booking, payment, decision and finished task in the month it happened. Dates marked ~ are taken from when a record was last edited rather than a true timestamp.",
    photos: slots([["Suit day", "square"], ["The hen do", "square"], ["The stag do", "square"]]),
    blocks: [{ kind: "timeline", months: deriveJourney(ctx.src) }],
  };
}

function chPeople(ctx: Ctx): MemoryChapter {
  const { src, attending } = ctx;
  const households = new Set(src.guests.map((g) => g.householdId)).size;
  const declined = src.guests.filter((g) => g.rsvp === "DECLINED");
  const stats: StatItem[] = [
    { label: "invited", value: src.guests.length },
    { label: "came", value: attending.length },
    { label: "declined", value: declined.length },
    { label: "children", value: attending.filter((g) => g.isChild).length },
    { label: "high chairs", value: attending.filter((g) => g.needsHighchair).length },
    { label: "households", value: households },
  ];

  // Wedding party: guest groups whose names say so, plus explicit roles.
  const groupNames = new Map<string, string[]>();
  for (const g of src.guests) {
    for (const grp of g.groups) {
      if (!/bridesmaid|groomsm|flower|best man|maid of honour|usher|wedding party/i.test(grp)) continue;
      const list = groupNames.get(grp) ?? [];
      list.push(`${g.firstName} ${g.lastName}`.trim());
      groupNames.set(grp, list);
    }
  }
  const partyCards: CardItem[] = [...groupNames.entries()].map(([grp, names]) => ({
    kicker: "Wedding party",
    title: grp,
    body: names.join(" · "),
  }));
  const roles = src.guests.filter((g) => g.role);
  if (roles.length) {
    partyCards.push({
      kicker: "Roles",
      title: "Who did what",
      body: roles.map((g) => `${g.firstName} ${g.lastName}: ${g.role}`).join(" · "),
    });
  }

  const name = (g: SrcGuest) => `${g.firstName} ${g.lastName}`.trim();
  const bySide = (side: SrcGuest["side"]) => attending.filter((g) => g.side === side).map(name).sort();
  const columns = [
    { label: "Bride's side", names: bySide("BRIDE") },
    { label: "Groom's side", names: bySide("GROOM") },
    { label: "Both, and friends", names: bySide("BOTH") },
  ].filter((c) => c.names.length);
  if (declined.length) columns.push({ label: "Couldn't make it", names: declined.map(name).sort() });

  const dietary = attending.filter((g) => g.dietary.length);
  const blocks: MemoryBlock[] = [{ kind: "stats", items: stats }];
  if (partyCards.length) blocks.push({ kind: "cards", items: partyCards, columns: 2 });
  blocks.push({ kind: "names", columns });
  if (dietary.length) {
    blocks.push({
      kind: "kv",
      rows: dietary.map((g) => ({ label: name(g), value: g.dietary.join(", ") })),
    });
  }
  return {
    key: "people",
    part: "before",
    number: 0,
    title: "The people",
    intro: `${src.guests.length} asked, ${attending.length} came.`,
    photos: slots([["Everyone, the group photo", "wide"]]),
    blocks,
  };
}

function supplierCard(s: SrcSupplier, src: MemorySources): CardItem {
  const lines: string[] = [];
  const contacts = s.contacts.map((c) => (c.role ? `${c.name}, ${c.role}` : c.name));
  if (contacts.length) lines.push(`Contact: ${contacts.join(" · ")}`);
  const signed = s.contracts.filter((c) => c.signed && c.signedAt).map((c) => c.signedAt!).sort()[0];
  if (signed) lines.push(`Contract signed ${fmtDate(signed)}`);
  const comms = [...s.communications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  for (const c of comms) lines.push(`${fmtDate(c.createdAt)} · ${c.channel}: ${clip(c.summary, 220)}`);
  const paid = src.payments.filter((p) => p.supplierName === s.name && p.status === "PAID");
  const body = firstParagraph(s.notes) ?? `${s.status === "PAID" ? "Paid in full." : "Booked."}`;
  const item: CardItem = { kicker: s.category, title: s.name, body, lines };
  if (s.website) item.href = s.website;
  if (paid.length && s.amountAgreed != null) {
    lines.push(`Agreed £${Math.round(s.amountAgreed).toLocaleString("en-GB")}`);
  }
  return item;
}

function chTeam(ctx: Ctx): MemoryChapter {
  const { src } = ctx;
  const booked = src.suppliers.filter((s) => s.status === "BOOKED" || s.status === "PAID");
  const others = src.suppliers.filter((s) => s.status !== "BOOKED" && s.status !== "PAID" && s.status !== "REJECTED");
  const blocks: MemoryBlock[] = [{ kind: "cards", items: booked.map((s) => supplierCard(s, src)), columns: 2 }];
  if (others.length) {
    blocks.push({
      kind: "paragraph",
      spans: [{ text: `Also considered: ${others.map((s) => `${s.name} (${s.category})`).join(", ")}.` }],
    });
  }
  return {
    key: "team",
    part: "before",
    number: 0,
    title: "The team",
    intro: `${booked.length} suppliers, with their contacts, contract dates and the thread of conversations that got us there.`,
    photos: slots([["The flowers", "wide"], ["The venue", "square"], ["The photographers at work", "square"]]),
    blocks,
  };
}

function bookChapter(
  ctx: Ctx,
  key: string,
  part: ChapterPart,
  title: string,
  intro: string,
  photoSpec: Array<[string, PhotoAspect]>,
  sectionSlug: string,
  extra: MemoryBlock[] = [],
  skip?: (c: SrcBookCard) => boolean,
): MemoryChapter {
  return {
    key,
    part,
    number: 0,
    title,
    intro,
    photos: slots(photoSpec),
    blocks: [...extra, ...sectionDocs(ctx.src, sectionSlug, skip)],
  };
}

function mealTally(attending: SrcGuest[]): Block | null {
  const rows: string[][] = [];
  const count = (pick: (g: SrcGuest) => string | null, course: string) => {
    const tally = new Map<string, number>();
    for (const g of attending) {
      const v = pick(g)?.trim();
      if (!v) continue;
      tally.set(v, (tally.get(v) ?? 0) + 1);
    }
    const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    sorted.forEach(([label, n], i) => rows.push([i === 0 ? course : "", label, String(n)]));
  };
  count((g) => g.mealStarter, "Starter");
  count((g) => g.mealMain, "Main");
  count((g) => g.mealDessert, "Dessert");
  if (!rows.length) return null;
  return { kind: "table", headers: ["Course", "Choice", "Picked"], rows };
}

function chEvents(ctx: Ctx, key: string, title: string, intro: string, day: string, photoSpec: Array<[string, PhotoAspect]>, extra: MemoryBlock[] = []): MemoryChapter | null {
  const events = ctx.src.events
    .filter((e) => dayOf(e.startTime) === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order);
  if (!events.length && !extra.length) return null;
  const items = events.map((e) => ({
    time: e.allDay ? "All day" : fmtTime(e.startTime),
    title: e.title,
    location: e.location,
    notes: e.notes ? clip(e.notes, 600) : null,
  }));
  const blocks: MemoryBlock[] = [];
  if (items.length) blocks.push({ kind: "events", items });
  blocks.push(...extra);
  return { key, part: "day", number: 0, title, intro, photos: slots(photoSpec), blocks };
}

function chTables(ctx: Ctx): MemoryChapter | null {
  const { src, attending } = ctx;
  if (!src.tables.length) return null;
  const seated = new Set(src.tables.flatMap((t) => t.seats.map((s) => s.guestName)).filter(Boolean));
  const unseated = attending.map((g) => `${g.firstName} ${g.lastName}`.trim()).filter((n) => !seated.has(n));
  const blocks: MemoryBlock[] = [
    { kind: "seating", tables: src.tables.map((t) => ({ name: t.name, shape: t.shape, seats: t.seats.map((s) => ({ index: s.index, name: s.guestName })) })) },
  ];
  if (unseated.length) blocks.push({ kind: "names", columns: [{ label: "Not at a table", names: unseated.sort() }] });
  const seats = src.tables.reduce((n, t) => n + t.seats.length, 0);
  return {
    key: "tables",
    part: "day",
    number: 0,
    title: "Who sat where",
    intro: `${src.tables.length} tables, ${seats} seats.`,
    photos: slots([["The room, laid", "wide"], ["A table", "square"], ["Another table", "square"]]),
    blocks,
  };
}

function chMusic(ctx: Ctx): MemoryChapter {
  const { src } = ctx;
  const blocks: MemoryBlock[] = [];
  const order = ["FIRST_DANCE", "CEREMONY", "BRIDAL_PREP", "DRINKS_RECEPTION", "WEDDING_BREAKFAST", "MUST_PLAY"];
  const playlists = src.playlists
    .filter((p) => !p.isBlockList)
    .sort((a, b) => (order.indexOf(a.category) + 99) % 100 - ((order.indexOf(b.category) + 99) % 100));
  for (const p of playlists) {
    blocks.push({ kind: "heading", text: `${p.name} · ${p.songs.length} song${p.songs.length === 1 ? "" : "s"}` });
    if (p.songs.length) {
      blocks.push({
        kind: "list",
        ordered: false,
        items: p.songs.map((s) => [{ text: s.artist ? `${s.title} — ${s.artist}` : s.title }]),
      });
    }
  }
  const requests = src.guests.flatMap((g) => g.songRequests.map((r) => ({ ...r, guest: `${g.firstName} ${g.lastName}`.trim() })));
  if (requests.length) {
    blocks.push({ kind: "heading", text: `Guest requests · ${requests.length}` });
    blocks.push({
      kind: "list",
      ordered: false,
      items: requests.map((r) => [{ text: `${r.artist ? `${r.title} — ${r.artist}` : r.title} · ${r.guest}` }]),
    });
  }
  const blocked = src.playlists.filter((p) => p.isBlockList && p.songs.length);
  for (const p of blocked) {
    blocks.push({ kind: "heading", text: `${p.name} (do not play)` });
    blocks.push({ kind: "list", ordered: false, items: p.songs.map((s) => [{ text: s.artist ? `${s.title} — ${s.artist}` : s.title }]) });
  }
  return {
    key: "music",
    part: "day",
    number: 0,
    title: "The music",
    intro: "Every playlist, and every request from the RSVP cards.",
    photos: slots([["First dance", "wide"], ["Dance floor", "square"], ["Last dance", "square"]]),
    blocks: blocks.length ? blocks : [{ kind: "empty", text: "No playlists were recorded." }],
  };
}

function chHoneymoon(ctx: Ctx): MemoryChapter {
  const { src } = ctx;
  const suppliers = src.suppliers.filter((s) => /honeymoon/i.test(s.category) || /honeymoon/i.test(s.name));
  const payments = src.payments.filter((p) => /honeymoon/i.test(p.description) || /honeymoon/i.test(p.notes ?? ""));
  const blocks: MemoryBlock[] = [];
  if (suppliers.length) blocks.push({ kind: "cards", items: suppliers.map((s) => supplierCard(s, src)), columns: 1 });
  const notes = payments.map((p) => p.notes).filter((n): n is string => !!n);
  if (notes.length) blocks.push(para(clip(notes[0]!, 700)));
  if (payments.length) {
    blocks.push({
      kind: "cards",
      money: true,
      items: payments.map((p) => ({
        kicker: p.paidDate ? `Paid ${fmtDate(p.paidDate)}` : p.status,
        title: p.description,
        body: `£${p.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}${p.method ? ` · ${p.method}` : ""}`,
        money: true,
      })),
    });
  }
  blocks.push({
    kind: "empty",
    text: "In your words: this chapter has room for a few paragraphs from the two of you. The walks, the weather, what you cooked.",
  });
  return {
    key: "honeymoon",
    part: "after",
    number: 0,
    title: "The honeymoon",
    intro: suppliers[0] ? `${suppliers[0].name}.` : undefined,
    photos: slots([["Where you stayed", "wide"], ["Day one", "square"], ["Day two", "square"], ["Day three", "square"], ["The two of you", "square"]]),
    blocks: blocks.length ? blocks : [{ kind: "empty", text: "No honeymoon booking was recorded." }],
  };
}

function chChats(ctx: Ctx): MemoryChapter | null {
  const threads = ctx.src.aiThreads.filter((t) => t.exchange);
  if (!ctx.src.aiThreads.length) return null;
  const exchanges = threads
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => ({ when: fmtDate(t.createdAt), user: t.exchange!.user, assistant: t.exchange!.assistant }));
  return {
    key: "chats",
    part: "after",
    number: 0,
    title: "Planning with Claude",
    intro: `${ctx.src.aiThreads.length} conversations with the planner inside Wedding Hub. The opening exchange of each.`,
    photos: [],
    blocks: exchanges.length ? [{ kind: "chat", exchanges }] : [{ kind: "empty", text: "The threads have no text to show." }],
  };
}

function chDecided(ctx: Ctx): MemoryChapter {
  const live = ctx.src.tasks.filter((t) => t.status !== "ARCHIVED");
  const toCard = (t: MemorySources["tasks"][number]): CardItem => {
    const answer = t.decisionAnswer ?? t.questionAnswer;
    return {
      kicker: `~ ${fmtDate(t.updatedAt)}`,
      title: t.title,
      body: answer ? clip(answer, 900) : t.notes ? clip(t.notes, 500) : "Decided; no answer was written down.",
    };
  };
  const decisions = live.filter((t) => t.type === "DECISION").sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const questions = live.filter((t) => t.type === "QUESTION").sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const blocks: MemoryBlock[] = [];
  if (decisions.length) {
    blocks.push({ kind: "heading", text: `Decisions · ${decisions.length}` });
    blocks.push({ kind: "cards", items: decisions.map(toCard), columns: 2 });
  }
  if (questions.length) {
    blocks.push({ kind: "heading", text: `Questions · ${questions.length}` });
    blocks.push({ kind: "cards", items: questions.map(toCard), columns: 2 });
  }
  return {
    key: "decided",
    part: "after",
    number: 0,
    title: "Everything we decided",
    intro: "Every decision and every question, with its answer and roughly when.",
    photos: [],
    blocks: blocks.length ? blocks : [{ kind: "empty", text: "No decisions were recorded." }],
  };
}

function chCost(ctx: Ctx): MemoryChapter | null {
  const { src } = ctx;
  if (!src.budget) return null;
  const paid = src.payments.filter((p) => p.status === "PAID").sort((a, b) => (a.paidDate ?? a.createdAt).localeCompare(b.paidDate ?? b.createdAt));
  return {
    key: "cost",
    part: "after",
    number: 0,
    title: "What it cost",
    intro: "Couple-only, and off unless you switch it on.",
    photos: [],
    money: true,
    blocks: [
      {
        kind: "moneyTable",
        money: true,
        rows: src.budget.categories.map((c) => ({ label: c.name, estimated: c.estimated, actual: c.actual, paid: c.paid })),
        total: src.budget.totals,
      },
      { kind: "heading", text: `Payments · ${paid.length}` },
      {
        kind: "cards",
        money: true,
        columns: 3,
        items: paid.map((p) => ({
          kicker: p.paidDate ? fmtDate(p.paidDate) : "Paid",
          title: p.description,
          body: `£${p.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}${p.supplierName ? ` · ${p.supplierName}` : ""}${p.method ? ` · ${p.method}` : ""}`,
          money: true,
        })),
      },
    ],
  };
}

// ─── Assembly ───────────────────────────────────────────────────────────

export function assembleMemoryBook(
  src: MemorySources,
  meta: { appVersion: string; generatedAt: string },
): MemoryBookData {
  const weddingDay = dayOf(src.settings.weddingDate);
  const attending = src.guests.filter((g) => g.rsvp === "ATTENDING");
  const journeyStart = firstRecordAt(src);
  const daysOfPlanning = journeyStart
    ? Math.max(0, Math.round((Date.parse(weddingDay) - Date.parse(dayOf(journeyStart))) / 86_400_000))
    : null;
  const ctx: Ctx = { src, weddingDay, attending, journeyStart, daysOfPlanning };

  const tally = mealTally(attending);
  const shotsSection = src.book.find((s) => s.slug === "photography");
  const shotStats: MemoryBlock[] = [];
  for (const c of shotsSection?.cards ?? []) {
    if (c.shots) shotStats.push({ kind: "stats", items: [{ label: `of ${c.shots.total} shots on the list were ticked off`, value: c.shots.captured }] });
  }

  const before: Array<MemoryChapter | null> = [
    chNumbers(ctx),
    chJourney(ctx),
    chPeople(ctx),
    chTeam(ctx),
    bookChapter(ctx, "look", "before", "The look", "What everyone wore, and the rings.", [["The dress", "portrait"], ["The suit", "portrait"], ["The bridesmaids", "wide"], ["The groomsmen", "wide"]], "clothing"),
    bookChapter(ctx, "decor", "before", "Flowers, decor and things we made", "The flower order, the centrepieces, the signs.", [["The bouquet", "square"], ["A centrepiece", "square"], ["Place names", "square"], ["The welcome sign", "square"]], "venue-decor"),
    bookChapter(ctx, "food", "before", "Food and drink", "The menu and what people picked, the bar, and the cakes.", [["The cake table", "wide"], ["The cutting", "square"], ["A plate", "square"]], "food-drink", tally ? [tally] : []),
    bookChapter(ctx, "games", "before", "Games, favours and gifts", "What was on the tables and in the bags.", [["A table on the puzzle", "square"], ["The photo booth", "square"], ["Favours", "square"]], "guest-experience"),
    bookChapter(ctx, "legal", "before", "Making it legal", "Giving notice and the registrar's form.", [], "legal"),
  ];
  // Unmapped Book sections get a chapter each so nothing is left out.
  for (const s of src.book) {
    if (SECTION_CHAPTER[s.slug]) continue;
    if (!s.cards.length) continue;
    before.push(bookChapter(ctx, `book-${s.slug}`, "before", s.title, s.subtitle ?? "From the Wedding Book.", [], s.slug));
  }

  const day: Array<MemoryChapter | null> = [
    chEvents(ctx, "eve", "The night before", `${fmtDateLong(`${shiftDay(weddingDay, -1)}T12:00:00Z`)}.`, shiftDay(weddingDay, -1), [["The suite", "wide"], ["Dinner the night before", "square"], ["The flowers, collected", "square"]], sectionDocs(src, "accommodation")),
    chEvents(ctx, "theday", "The running order", `${fmtDateLong(src.settings.weddingDate)} · ${src.settings.venue}.`, weddingDay, [["Getting ready", "square"], ["Guests arriving", "square"], ["The terrace", "square"], ["Speeches", "square"], ["Cake", "square"], ["First dance", "square"]]),
    bookChapter(ctx, "ceremony", "day", "The ceremony", src.settings.ceremonyTime, [["Walking in", "portrait"], ["The vows", "wide"], ["The rings", "square"], ["Walking out", "square"]], "ceremony-amp-music"),
    bookChapter(ctx, "photos", "day", "The photographs", "The brief, the shot list, and how it was delivered.", [["A favourite", "wide"], ["Another", "square"], ["And another", "square"]], "photography", shotStats),
    chTables(ctx),
    chMusic(ctx),
  ];

  const after: Array<MemoryChapter | null> = [
    chHoneymoon(ctx),
    {
      key: "guestbook",
      part: "after",
      number: 0,
      title: "The guestbook and the cards",
      intro: "A photo of each page and card, with the words typed up so they're searchable and survive the handwriting.",
      photos: slots([["Guestbook page", "wide"], ["Guestbook page", "wide"], ["A card", "portrait"], ["A card", "portrait"]]),
      blocks: [{ kind: "empty", text: "Coming next: add each page and card here with a transcript and who it was from." }],
    },
    {
      key: "gifts",
      part: "after",
      number: 0,
      title: "Gifts and thank-yous",
      intro: "Who gave what, and when we said thank you.",
      photos: slots([["The cards-and-gifts table", "wide"]]),
      blocks: sectionDocs(src, "post-wedding", (c) => !/thank/i.test(c.slug)),
    },
    chChats(ctx),
    bookChapter(ctx, "paperwork", "after", "The paperwork", "Certificates, filing, reviews and the gallery.", [], "post-wedding", [], (c) => /thank/i.test(c.slug)),
    chDecided(ctx),
    chCost(ctx),
  ];

  const chapters = [...before, ...day, ...after].filter((c): c is MemoryChapter => c !== null);
  chapters.forEach((c, i) => (c.number = i + 1));

  return {
    generatedAt: meta.generatedAt,
    appVersion: meta.appVersion,
    wedding: {
      coupleShort: src.settings.coupleShort,
      coupleLabel: src.settings.coupleLabel,
      brideFirst: src.settings.brideFirst,
      groomFirst: src.settings.groomFirst,
      weddingDate: src.settings.weddingDate,
      ceremonyTime: src.settings.ceremonyTime,
      venue: src.settings.venue,
      venueAddress: src.settings.venueAddress,
    },
    planning: { firstRecordAt: journeyStart, daysOfPlanning },
    chapters,
    moneyIncluded: src.budget !== null,
  };
}
