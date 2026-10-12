import { describe, expect, it } from "vitest";
import { deriveJourney, firstRecordAt, monthLabel, supplierBookedAt } from "@/lib/memories/journey";
import { fixture } from "./memories-fixture";

describe("journey", () => {
  it("labels months and orders them across a year boundary", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
    const months = deriveJourney(fixture()).map((m) => m.month);
    expect(months[0]).toBe("2025-03");
    expect(months).toEqual([...months].sort());
    expect(months).toContain("2026-09");
  });

  it("finds the earliest record as the start of planning", () => {
    expect(firstRecordAt(fixture())).toBe("2025-03-01T10:00:00.000Z");
  });

  it("dates a supplier booking from the contract, then payment, then communication", () => {
    const src = fixture();
    const venue = src.suppliers[0]!;
    expect(supplierBookedAt(venue, src.payments)).toEqual({ at: "2025-04-02T00:00:00.000Z", approx: false });
    const dens = src.suppliers[1]!;
    expect(supplierBookedAt(dens, src.payments)).toEqual({ at: "2026-09-20T10:00:00.000Z", approx: true });
    expect(supplierBookedAt(src.suppliers[2]!, src.payments)).toBeNull();
  });

  it("counts tasks by created and finished month, skipping archived", () => {
    const months = deriveJourney(fixture());
    const mar25 = months.find((m) => m.month === "2025-03")!;
    const apr25 = months.find((m) => m.month === "2025-04")!;
    expect(mar25.counts.tasksCreated).toBe(1);
    expect(apr25.counts.tasksDone).toBe(1);
    expect(apr25.tasksDone).toEqual(["Book the venue"]);
    expect(months.some((m) => m.month === "2026-01")).toBe(false);
  });

  it("marks decisions and answered questions as approximate highlights", () => {
    const months = deriveJourney(fixture());
    const aug = months.find((m) => m.month === "2026-08")!;
    const decision = aug.highlights.find((h) => h.kind === "decision")!;
    expect(decision.approx).toBe(true);
    expect(decision.text).toContain("Detectorists");
    const sep = months.find((m) => m.month === "2026-09")!;
    expect(sep.highlights.some((h) => h.kind === "question")).toBe(true);
  });

  it("flags payments as money and excludes unpaid ones", () => {
    const months = deriveJourney(fixture());
    const paid = months.flatMap((m) => m.highlights).filter((h) => h.kind === "paid");
    expect(paid).toHaveLength(2);
    expect(paid.every((h) => h.money)).toBe(true);
    expect(paid.some((h) => h.text.includes("Flowers balance"))).toBe(false);
  });

  it("ignores plus-ones for guests added and puts the wedding last", () => {
    const months = deriveJourney(fixture());
    const apr26 = months.find((m) => m.month === "2026-04")!;
    expect(apr26.counts.guestsAdded).toBe(4);
    expect(apr26.counts.songsAdded).toBe(1);
    const last = months[months.length - 1]!;
    expect(last.highlights[0]).toMatchObject({ kind: "milestone", text: "The wedding" });
  });

  it("includes planning events but not day-of events", () => {
    const all = deriveJourney(fixture()).flatMap((m) => m.highlights);
    expect(all.some((h) => h.kind === "event" && h.text === "Suit Day")).toBe(true);
    expect(all.some((h) => h.text === "Ceremony")).toBe(false);
  });

  it("returns only the wedding milestone for an empty wedding", () => {
    const src = fixture();
    const empty = { ...src, tasks: [], guests: [], suppliers: [], payments: [], files: [], playlists: [], book: [], events: [] };
    const months = deriveJourney(empty);
    expect(months).toHaveLength(1);
    expect(months[0]!.highlights).toHaveLength(1);
  });
});
