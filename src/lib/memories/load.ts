// v2.17.0: Prisma → MemorySources. The only file in src/lib/memories
// that touches the database. Couple-only data (budget, payments, AI
// threads) is read unconditionally here; the caller owns the gate
// (the page redirects non-couple users before calling buildMemoryBook).
//
// Book cards go through loadCardExport + cardToDoc so every card kind
// renders the way the share/print path already renders it (v2.14.0).

import { db } from "@/lib/db";
import { cardToDoc } from "@/lib/book-card-doc";
import { loadCardExport } from "@/lib/core/book-export";
import { decodeHtmlEntities, stripHtml } from "@/lib/html-text";
import {
  applyMinimum,
  computeActual,
  computeCompositeActual,
  computeCompositePaid,
  computeEstimated,
  computePaid,
} from "@/lib/budget";
import { fetchAllHeadcounts } from "@/lib/headcount";
import { getWeddingSettings } from "@/lib/wedding-settings";
import type { PerHeadSource } from "@prisma/client";
import type { MemorySources, SrcAiThread, SrcBookSection, SrcBudget } from "./sources";

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const text = (s: string | null | undefined): string | null => (s == null ? null : decodeHtmlEntities(stripHtml(s)));
const num = (d: { toString(): string } | null | undefined): number | null => {
  if (d == null) return null;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : null;
};

type HeadcountMap = Awaited<ReturnType<typeof fetchAllHeadcounts>>;

function resolveHeadcount(
  row: { headcountSource: PerHeadSource | null; manualHeadcount: number | null },
  counts: HeadcountMap,
): number | null {
  if (row.headcountSource == null) return null;
  if (row.headcountSource === "MANUAL") return Math.max(0, row.manualHeadcount ?? 0);
  return counts[row.headcountSource];
}

async function loadBudget(): Promise<SrcBudget> {
  const [categories, headcounts] = await Promise.all([
    db.budgetCategory.findMany({
      orderBy: { order: "asc" },
      select: {
        name: true,
        lines: {
          select: {
            estimated: true,
            actual: true,
            paid: true,
            perHeadPence: true,
            headcountSource: true,
            manualHeadcount: true,
            minimumHeadcount: true,
            fundSource: true,
            fundLabel: true,
            payments: { select: { amount: true, status: true } },
            components: {
              select: {
                flatPence: true,
                perHeadPence: true,
                headcountSource: true,
                manualHeadcount: true,
                minimumHeadcount: true,
                fundSource: true,
                payments: { select: { amount: true, status: true } },
              },
            },
          },
        },
      },
    }),
    fetchAllHeadcounts(),
  ]);
  const totals = { estimated: 0, actual: 0, paid: 0 };
  const cats = categories.map((c) => {
    let est = 0, actual = 0, paid = 0;
    for (const l of c.lines) {
      est += l.components.length
        ? l.components.reduce((s, comp) => {
            if (comp.perHeadPence != null && comp.headcountSource != null) {
              const raw = resolveHeadcount(comp, headcounts) ?? 0;
              return s + (comp.perHeadPence * applyMinimum(raw, comp.minimumHeadcount)) / 100;
            }
            return s + (comp.flatPence != null ? comp.flatPence / 100 : 0);
          }, 0)
        : computeEstimated(l, resolveHeadcount(l, headcounts));
      actual += l.components.length ? computeCompositeActual(l) : computeActual(l);
      paid += l.components.length ? computeCompositePaid(l) : computePaid(l);
    }
    totals.estimated += est;
    totals.actual += actual;
    totals.paid += paid;
    return { name: c.name, estimated: est, actual, paid };
  });
  return { categories: cats, totals };
}

async function loadBook(): Promise<SrcBookSection[]> {
  const sections = await db.bookSection.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      order: true,
      createdAt: true,
      subsections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          kind: true,
          visibility: true,
          shotList: { select: { shots: { select: { captured: true } } } },
        },
      },
    },
  });
  const out: SrcBookSection[] = [];
  for (const s of sections) {
    const cards = [];
    for (const c of s.subsections) {
      const exp = await loadCardExport(c.id);
      if (!exp) continue;
      const doc = cardToDoc(exp);
      const shots = c.shotList
        ? { total: c.shotList.shots.length, captured: c.shotList.shots.filter((x) => x.captured).length }
        : undefined;
      cards.push({ id: c.id, slug: c.slug, title: decodeHtmlEntities(c.title), kind: c.kind, visibility: c.visibility, doc, ...(shots ? { shots } : {}) });
    }
    out.push({ id: s.id, slug: s.slug, title: decodeHtmlEntities(s.title), subtitle: s.subtitle, order: s.order, createdAt: s.createdAt.toISOString(), cards });
  }
  return out;
}

async function loadAiThreads(): Promise<SrcAiThread[]> {
  const threads = await db.aiThread.findMany({
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      title: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 12,
        select: { role: true, content: true },
      },
    },
  });
  return threads.map((t) => {
    const user = t.messages.find((m) => m.role === "user" && m.content.trim());
    const assistant = t.messages.find((m) => m.role === "assistant" && m.content.trim());
    const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
    return {
      id: t.id,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      exchange: user && assistant ? { user: clip(user.content.trim(), 600), assistant: clip(assistant.content.trim(), 900) } : null,
    };
  });
}

export async function loadMemorySources(): Promise<MemorySources> {
  const [settings, guests, tables, tasks, events, suppliers, payments, playlists, files, book, aiThreads, budget] =
    await Promise.all([
      getWeddingSettings(),
      db.guest.findMany({
        where: { archived: false },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rsvp: true,
          isChild: true,
          needsHighchair: true,
          side: true,
          role: true,
          dietary: true,
          mealStarter: true,
          mealMain: true,
          mealDessert: true,
          householdId: true,
          household: { select: { name: true } },
          groups: { select: { name: true } },
          parentGuestId: true,
          createdAt: true,
          tableSeat: { select: { table: { select: { name: true } } } },
          songRequests: { select: { title: true, artist: true, createdAt: true } },
        },
      }),
      db.table.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          shape: true,
          capacity: true,
          seats: {
            orderBy: { index: "asc" },
            select: { index: true, guest: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      db.task.findMany({
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          decisionAnswer: true,
          questionAnswer: true,
          notes: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          supplier: { select: { name: true } },
          bookSections: { select: { slug: true } },
        },
      }),
      db.scheduleEvent.findMany({
        orderBy: [{ startTime: "asc" }, { order: "asc" }],
        select: { id: true, title: true, startTime: true, endTime: true, location: true, notes: true, allDay: true, printable: true, order: true },
      }),
      db.supplier.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          status: true,
          website: true,
          notes: true,
          amountAgreed: true,
          createdAt: true,
          contacts: { select: { name: true, role: true, primary: true } },
          contracts: { select: { signed: true, signedAt: true } },
          communications: { orderBy: { createdAt: "asc" }, select: { channel: true, summary: true, createdAt: true } },
        },
      }),
      db.payment.findMany({
        orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          description: true,
          amount: true,
          status: true,
          dueDate: true,
          paidDate: true,
          method: true,
          notes: true,
          createdAt: true,
          supplier: { select: { name: true } },
        },
      }),
      db.playlist.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          isBlockList: true,
          songs: { orderBy: { order: "asc" }, select: { title: true, artist: true, createdAt: true } },
        },
      }),
      db.file.findMany({ select: { id: true, name: true, mimeType: true, folder: true, createdAt: true } }),
      loadBook(),
      loadAiThreads(),
      loadBudget(),
    ]);

  return {
    settings: {
      weddingDate: settings.weddingDate.toISOString(),
      ceremonyTime: settings.ceremonyTime,
      venue: settings.venue,
      venueAddress: settings.venueAddress,
      coupleLabel: settings.coupleLabel,
      coupleShort: settings.coupleShort,
      brideFirst: settings.brideFirst,
      groomFirst: settings.groomFirst,
    },
    guests: guests.map((g) => ({
      id: g.id,
      firstName: decodeHtmlEntities(g.firstName),
      lastName: decodeHtmlEntities(g.lastName),
      rsvp: g.rsvp,
      isChild: g.isChild,
      needsHighchair: g.needsHighchair,
      side: g.side,
      role: g.role,
      dietary: g.dietary,
      mealStarter: text(g.mealStarter),
      mealMain: text(g.mealMain),
      mealDessert: text(g.mealDessert),
      householdId: g.householdId,
      householdName: decodeHtmlEntities(g.household.name),
      groups: g.groups.map((x) => x.name),
      isPlusOne: g.parentGuestId != null,
      createdAt: g.createdAt.toISOString(),
      seatTableName: g.tableSeat?.table.name ?? null,
      songRequests: g.songRequests.map((r) => ({ title: r.title, artist: r.artist, createdAt: r.createdAt.toISOString() })),
    })),
    tables: tables.map((t) => ({
      id: t.id,
      name: t.name,
      shape: t.shape,
      capacity: t.capacity,
      seats: t.seats.map((s) => ({
        index: s.index,
        guestName: s.guest ? `${decodeHtmlEntities(s.guest.firstName)} ${decodeHtmlEntities(s.guest.lastName)}`.trim() : null,
      })),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: decodeHtmlEntities(t.title),
      type: t.type,
      status: t.status,
      decisionAnswer: text(t.decisionAnswer),
      questionAnswer: text(t.questionAnswer),
      notes: text(t.notes),
      dueDate: iso(t.dueDate),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      supplierName: t.supplier?.name ?? null,
      sectionSlugs: t.bookSections.map((s) => s.slug),
    })),
    events: events.map((e) => ({
      id: e.id,
      title: decodeHtmlEntities(e.title),
      startTime: e.startTime.toISOString(),
      endTime: iso(e.endTime),
      location: e.location,
      notes: text(e.notes),
      allDay: e.allDay,
      printable: e.printable,
      order: e.order,
    })),
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      status: s.status,
      website: s.website,
      notes: text(s.notes),
      amountAgreed: num(s.amountAgreed),
      createdAt: s.createdAt.toISOString(),
      contacts: s.contacts,
      contracts: s.contracts.map((c) => ({ signed: c.signed, signedAt: iso(c.signedAt) })),
      communications: s.communications.map((c) => ({ channel: c.channel, summary: text(c.summary) ?? "", createdAt: c.createdAt.toISOString() })),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      description: decodeHtmlEntities(p.description),
      amount: num(p.amount) ?? 0,
      status: p.status,
      dueDate: iso(p.dueDate),
      paidDate: iso(p.paidDate),
      method: p.method,
      supplierName: p.supplier?.name ?? null,
      notes: text(p.notes),
      createdAt: p.createdAt.toISOString(),
    })),
    budget,
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      isBlockList: p.isBlockList,
      songs: p.songs.map((s) => ({ title: s.title, artist: s.artist, createdAt: s.createdAt.toISOString() })),
    })),
    book,
    files: files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, folder: f.folder, createdAt: f.createdAt.toISOString() })),
    aiThreads,
  };
}
