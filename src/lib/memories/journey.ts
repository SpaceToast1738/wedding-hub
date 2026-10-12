// v2.17.0: "How it came together" — the planning story, month by month.
//
// The audit log is purged after 30 days (src/lib/audit.ts), so the
// history has to be rebuilt from the records themselves: when tasks
// were created and last touched, when suppliers signed, when payments
// went out, when guests, files and songs arrived. Dates taken from
// `updatedAt` are honest about it: `approx: true`, shown with a "~".
//
// Pure: takes MemorySources, returns TimelineMonth[] in order.

import type { MemorySources, SrcSupplier } from "./sources";
import type { TimelineHighlight, TimelineMonth } from "./types";

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return MONTH_LABEL.format(new Date(Date.UTC(y, m - 1, 1)));
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

/** Earliest known record across the sources (the start of planning). */
export function firstRecordAt(src: MemorySources): string | null {
  const dates: string[] = [];
  for (const t of src.tasks) dates.push(t.createdAt);
  for (const g of src.guests) dates.push(g.createdAt);
  for (const s of src.suppliers) {
    dates.push(s.createdAt);
    for (const c of s.contracts) if (c.signedAt) dates.push(c.signedAt);
  }
  for (const p of src.payments) if (p.paidDate) dates.push(p.paidDate);
  for (const s of src.book) dates.push(s.createdAt);
  if (!dates.length) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

/**
 * When a supplier was "booked": the first contract signature, else the
 * earliest paid payment to them, else their first logged communication,
 * else the row's creation. Returns the date and whether it is exact.
 */
export function supplierBookedAt(
  s: SrcSupplier,
  payments: MemorySources["payments"],
): { at: string; approx: boolean } | null {
  if (s.status !== "BOOKED" && s.status !== "PAID") return null;
  const signed = s.contracts.map((c) => c.signedAt).filter((d): d is string => !!d).sort();
  if (signed.length) return { at: signed[0]!, approx: false };
  const paid = payments
    .filter((p) => p.supplierName === s.name && p.status === "PAID" && p.paidDate)
    .map((p) => p.paidDate!)
    .sort();
  if (paid.length) return { at: paid[0]!, approx: false };
  const comms = s.communications.map((c) => c.createdAt).sort();
  if (comms.length) return { at: comms[0]!, approx: true };
  return { at: s.createdAt, approx: true };
}

function emptyMonth(key: string): TimelineMonth {
  return {
    month: key,
    label: monthLabel(key),
    counts: {
      tasksCreated: 0,
      tasksDone: 0,
      decisions: 0,
      questionsAnswered: 0,
      suppliersBooked: 0,
      paymentsPaid: 0,
      guestsAdded: 0,
      filesUploaded: 0,
      songsAdded: 0,
    },
    highlights: [],
    tasksDone: [],
  };
}

export function deriveJourney(src: MemorySources): TimelineMonth[] {
  const months = new Map<string, TimelineMonth>();
  const get = (iso: string) => {
    const k = monthKey(iso);
    let m = months.get(k);
    if (!m) {
      m = emptyMonth(k);
      months.set(k, m);
    }
    return m;
  };
  const push = (iso: string, h: TimelineHighlight) => get(iso).highlights.push(h);

  for (const t of src.tasks) {
    if (t.status === "ARCHIVED") continue;
    if (t.type === "TASK") get(t.createdAt).counts.tasksCreated += 1;
    if (t.status !== "DONE") continue;
    const m = get(t.updatedAt);
    if (t.type === "TASK") {
      m.counts.tasksDone += 1;
      m.tasksDone.push(t.title);
    } else if (t.type === "DECISION") {
      m.counts.decisions += 1;
      const answer = t.decisionAnswer ?? t.questionAnswer;
      push(t.updatedAt, {
        kind: "decision",
        text: answer ? `${clip(t.title, 90)} — ${clip(answer, 140)}` : clip(t.title, 120),
        approx: true,
      });
    } else if (t.type === "QUESTION" && (t.questionAnswer || t.decisionAnswer)) {
      m.counts.questionsAnswered += 1;
      push(t.updatedAt, {
        kind: "question",
        text: `${clip(t.title, 90)} — ${clip((t.questionAnswer ?? t.decisionAnswer)!, 140)}`,
        approx: true,
      });
    }
  }

  for (const s of src.suppliers) {
    const booked = supplierBookedAt(s, src.payments);
    if (!booked) continue;
    const m = get(booked.at);
    m.counts.suppliersBooked += 1;
    push(booked.at, { kind: "booked", text: `Booked ${s.name} (${s.category})`, approx: booked.approx });
  }

  for (const p of src.payments) {
    if (p.status !== "PAID") continue;
    const at = p.paidDate ?? p.createdAt;
    get(at).counts.paymentsPaid += 1;
    const who = p.supplierName ? ` · ${p.supplierName}` : "";
    push(at, {
      kind: "paid",
      text: `Paid £${Math.round(p.amount).toLocaleString("en-GB")}: ${clip(p.description, 80)}${who}`,
      approx: !p.paidDate,
      money: true,
    });
  }

  for (const g of src.guests) {
    if (g.isPlusOne) continue;
    get(g.createdAt).counts.guestsAdded += 1;
  }
  for (const f of src.files) get(f.createdAt).counts.filesUploaded += 1;
  for (const pl of src.playlists) for (const s of pl.songs) get(s.createdAt).counts.songsAdded += 1;
  for (const g of src.guests) for (const r of g.songRequests) get(r.createdAt).counts.songsAdded += 1;

  for (const s of src.book) {
    push(s.createdAt, { kind: "milestone", text: `Started the “${s.title}” section of the Book`, approx: false });
  }

  // Planning-timeline events (not on the wedding day itself): hen do,
  // suit day, giving notice, the final details meeting.
  const weddingDay = src.settings.weddingDate.slice(0, 10);
  for (const e of src.events) {
    const day = e.startTime.slice(0, 10);
    if (day >= weddingDay) continue;
    push(e.startTime, { kind: "event", text: clip(e.title, 120), approx: false });
  }

  // The wedding itself closes the story.
  push(src.settings.weddingDate, { kind: "milestone", text: "The wedding", approx: false });

  const ordered = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const m of ordered) {
    const rank: Record<TimelineHighlight["kind"], number> = {
      milestone: 0,
      event: 1,
      booked: 2,
      decision: 3,
      question: 4,
      paid: 5,
    };
    m.highlights.sort((a, b) => rank[a.kind] - rank[b.kind]);
    m.tasksDone.sort((a, b) => a.localeCompare(b));
  }
  return ordered;
}
