import { describe, expect, it } from "vitest";
import {
  decideOverdueTaskDigest,
  decideUnconfirmedRsvpDigest,
  nudgeEligible,
  sortOverdueTasksForEmail,
  type RsvpRow,
  type TaskRow,
} from "@/lib/nudge-digest";

const NOW = new Date("2026-04-29T10:00:00Z");
const SIX_DAYS_AGO = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000);
const EIGHT_DAYS_AGO = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000);

function rsvpRow(overrides: Partial<RsvpRow> = {}): RsvpRow {
  return {
    id: "g1",
    firstName: "Bryony",
    lastName: "Olwyn-Davis",
    rsvp: "PENDING",
    archived: false,
    lastNudgedAt: null,
    parentGuestId: null,
    ...overrides,
  };
}

function taskRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "t1",
    title: "Book registrar",
    status: "OPEN",
    priority: "MEDIUM",
    assignees: [],
    dueDate: new Date(NOW.getTime() - 24 * 60 * 60 * 1000), // 1 day overdue
    type: "TASK",
    lastNudgedAt: null,
    ...overrides,
  };
}

describe("nudgeEligible — v1.25.0", () => {
  it("treats null as eligible (never nudged before)", () => {
    expect(nudgeEligible(null, NOW)).toBe(true);
  });
  it("rejects rows nudged within the 7-day cooldown", () => {
    expect(nudgeEligible(SIX_DAYS_AGO, NOW)).toBe(false);
  });
  it("admits rows nudged more than 7 days ago", () => {
    expect(nudgeEligible(EIGHT_DAYS_AGO, NOW)).toBe(true);
  });
  it("admits rows nudged exactly at the 7-day boundary", () => {
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(nudgeEligible(sevenDaysAgo, NOW)).toBe(true);
  });
});

describe("decideUnconfirmedRsvpDigest — v1.25.0", () => {
  it("includes never-nudged PENDING guests", () => {
    const out = decideUnconfirmedRsvpDigest([rsvpRow()], NOW);
    expect(out.map((g) => g.id)).toEqual(["g1"]);
  });
  it("includes MAYBE same as PENDING (both haven't committed)", () => {
    const out = decideUnconfirmedRsvpDigest([rsvpRow({ rsvp: "MAYBE" })], NOW);
    expect(out).toHaveLength(1);
  });
  it("excludes ATTENDING and DECLINED", () => {
    const guests = [
      rsvpRow({ id: "a", rsvp: "ATTENDING" }),
      rsvpRow({ id: "d", rsvp: "DECLINED" }),
      rsvpRow({ id: "p", rsvp: "PENDING" }),
    ];
    const out = decideUnconfirmedRsvpDigest(guests, NOW);
    expect(out.map((g) => g.id)).toEqual(["p"]);
  });
  it("excludes archived guests", () => {
    const out = decideUnconfirmedRsvpDigest(
      [rsvpRow({ archived: true })],
      NOW,
    );
    expect(out).toHaveLength(0);
  });
  it("excludes plus-ones (parentGuestId set)", () => {
    const out = decideUnconfirmedRsvpDigest(
      [rsvpRow({ parentGuestId: "host-1" })],
      NOW,
    );
    expect(out).toHaveLength(0);
  });
  it("excludes guests nudged within cooldown", () => {
    const out = decideUnconfirmedRsvpDigest(
      [rsvpRow({ lastNudgedAt: SIX_DAYS_AGO })],
      NOW,
    );
    expect(out).toHaveLength(0);
  });
  it("includes guests nudged before cooldown", () => {
    const out = decideUnconfirmedRsvpDigest(
      [rsvpRow({ lastNudgedAt: EIGHT_DAYS_AGO })],
      NOW,
    );
    expect(out).toHaveLength(1);
  });
});

describe("decideOverdueTaskDigest — v1.25.0", () => {
  it("includes overdue OPEN tasks never nudged", () => {
    const out = decideOverdueTaskDigest([taskRow()], NOW);
    expect(out.map((t) => t.id)).toEqual(["t1"]);
  });
  it("excludes future-dated tasks", () => {
    const future = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const out = decideOverdueTaskDigest([taskRow({ dueDate: future })], NOW);
    expect(out).toHaveLength(0);
  });
  it("excludes tasks with no dueDate", () => {
    const out = decideOverdueTaskDigest([taskRow({ dueDate: null })], NOW);
    expect(out).toHaveLength(0);
  });
  it("excludes DONE / ARCHIVED tasks", () => {
    const tasks = [
      taskRow({ id: "d", status: "DONE" }),
      taskRow({ id: "a", status: "ARCHIVED" }),
      taskRow({ id: "o", status: "OPEN" }),
    ];
    const out = decideOverdueTaskDigest(tasks, NOW);
    expect(out.map((t) => t.id)).toEqual(["o"]);
  });
  it("excludes QUESTION + DECISION (only TASK is overdue-eligible)", () => {
    const tasks = [
      taskRow({ id: "q", type: "QUESTION" }),
      taskRow({ id: "d", type: "DECISION" }),
      taskRow({ id: "t", type: "TASK" }),
    ];
    const out = decideOverdueTaskDigest(tasks, NOW);
    expect(out.map((t) => t.id)).toEqual(["t"]);
  });
  it("excludes recently-nudged tasks", () => {
    const out = decideOverdueTaskDigest(
      [taskRow({ lastNudgedAt: SIX_DAYS_AGO })],
      NOW,
    );
    expect(out).toHaveLength(0);
  });
});

describe("sortOverdueTasksForEmail — v1.25.0", () => {
  it("sorts URGENT first, then HIGH, then by due-date ascending", () => {
    const day1 = new Date("2026-04-25");
    const day2 = new Date("2026-04-26");
    const tasks = [
      taskRow({ id: "low-old", priority: "LOW", dueDate: day1 }),
      taskRow({ id: "high-new", priority: "HIGH", dueDate: day2 }),
      taskRow({ id: "urgent-new", priority: "URGENT", dueDate: day2 }),
      taskRow({ id: "urgent-old", priority: "URGENT", dueDate: day1 }),
      taskRow({ id: "med-new", priority: "MEDIUM", dueDate: day2 }),
    ];
    const out = sortOverdueTasksForEmail(tasks);
    expect(out.map((t) => t.id)).toEqual([
      "urgent-old",
      "urgent-new",
      "high-new",
      "med-new",
      "low-old",
    ]);
  });
  it("places null-due tasks at the end", () => {
    const tasks = [
      taskRow({ id: "null", dueDate: null }),
      taskRow({ id: "real", dueDate: new Date("2026-04-25") }),
    ];
    const out = sortOverdueTasksForEmail(tasks);
    expect(out.map((t) => t.id)).toEqual(["real", "null"]);
  });
});
