import { describe, expect, it } from "vitest";
import { SECTION_CHAPTER, assembleMemoryBook, fmtTime } from "@/lib/memories/assemble";
import { fixture } from "./memories-fixture";

const META = { appVersion: "2.17.0", generatedAt: "2026-10-12T09:00:00.000Z" };

describe("assembleMemoryBook", () => {
  const data = assembleMemoryBook(fixture(), META);
  const byKey = (k: string) => data.chapters.find((c) => c.key === k);

  it("numbers chapters consecutively across the three parts", () => {
    expect(data.chapters.map((c) => c.number)).toEqual(data.chapters.map((_, i) => i + 1));
    const parts = data.chapters.map((c) => c.part);
    const firstDay = parts.indexOf("day");
    const firstAfter = parts.indexOf("after");
    expect(parts.slice(0, firstDay).every((p) => p === "before")).toBe(true);
    expect(parts.slice(firstDay, firstAfter).every((p) => p === "day")).toBe(true);
    expect(parts.slice(firstAfter).every((p) => p === "after")).toBe(true);
  });

  it("computes the planning span from the first record to the wedding day", () => {
    expect(data.planning.firstRecordAt).toBe("2025-03-01T10:00:00.000Z");
    expect(data.planning.daysOfPlanning).toBe(572);
    const stats = byKey("numbers")!.blocks[0]!;
    expect(stats.kind).toBe("stats");
    if (stats.kind === "stats") {
      expect(stats.items[0]).toMatchObject({ value: 572, hero: true });
      expect(stats.items.some((i) => i.money)).toBe(true);
    }
  });

  it("absorbs mapped Book sections and gives unmapped ones their own chapter", () => {
    expect(SECTION_CHAPTER["food-drink"]).toBe("food");
    const food = byKey("food")!;
    expect(food.blocks.some((b) => b.kind === "doc" && b.source.cardSlug === "wedding-breakfast")).toBe(true);
    // The meal tally sits before the cards.
    expect(food.blocks[0]!.kind).toBe("table");
    const extra = byKey("book-something-else")!;
    expect(extra.title).toBe("Something Else");
    expect(extra.part).toBe("before");
  });

  it("splits post-wedding between gifts and paperwork", () => {
    const gifts = byKey("gifts")!;
    const paperwork = byKey("paperwork")!;
    const slugs = (c: typeof gifts) => c.blocks.flatMap((b) => (b.kind === "doc" ? [b.source.cardSlug] : []));
    expect(slugs(gifts)).toEqual(["thank-you-tracking"]);
    expect(slugs(paperwork)).toEqual(["marriage-cert-filing"]);
  });

  it("puts the night before and the wedding day on separate chapters, wall-clock times", () => {
    const eve = byKey("eve")!;
    const day = byKey("theday")!;
    const evItems = eve.blocks.find((b) => b.kind === "events");
    const dayItems = day.blocks.find((b) => b.kind === "events");
    expect(evItems && evItems.kind === "events" ? evItems.items.map((i) => i.title) : []).toEqual(["Bridal suite check-in"]);
    expect(dayItems && dayItems.kind === "events" ? dayItems.items.map((i) => i.time) : []).toEqual(["2:00pm", "2:30pm"]);
    expect(fmtTime("2026-09-24T12:30:00.000Z")).toBe("12:30pm");
  });

  it("counts people and finds the wedding party from groups and roles", () => {
    const people = byKey("people")!;
    const stats = people.blocks[0]!;
    if (stats.kind !== "stats") throw new Error("expected stats");
    const get = (label: string) => stats.items.find((i) => i.label === label)!.value;
    expect(get("invited")).toBe(5);
    expect(get("came")).toBe(4);
    expect(get("declined")).toBe(1);
    expect(get("children")).toBe(1);
    expect(get("high chairs")).toBe(1);
    const cards = people.blocks.find((b) => b.kind === "cards");
    expect(cards && cards.kind === "cards" ? cards.items.map((c) => c.title) : []).toEqual(["Bridesmaids", "Who did what"]);
    const names = people.blocks.find((b) => b.kind === "names");
    expect(names && names.kind === "names" ? names.columns.map((c) => c.label) : []).toContain("Couldn't make it");
  });

  it("lists booked suppliers with contacts, contract date and recent emails", () => {
    const team = byKey("team")!;
    const cards = team.blocks[0]!;
    if (cards.kind !== "cards") throw new Error("expected cards");
    expect(cards.items.map((c) => c.title)).toEqual(["Alveston Manor", "Devon Dens"]);
    const venue = cards.items[0]!;
    expect(venue.body).toBe("The venue.");
    expect(venue.lines).toEqual(
      expect.arrayContaining([expect.stringContaining("Jen Hammocks"), expect.stringContaining("Contract signed 2 Apr 2025")]),
    );
    expect(cards.items[1]!.href).toBe("https://www.devondens.co.uk");
  });

  it("seats and flags unseated attending guests", () => {
    const tables = byKey("tables")!;
    const seating = tables.blocks[0]!;
    if (seating.kind !== "seating") throw new Error("expected seating");
    expect(seating.tables[0]!.shape).toBe("HEAD");
    expect(seating.tables[1]!.seats[2]!.name).toBeNull();
    const names = tables.blocks.find((b) => b.kind === "names");
    expect(names && names.kind === "names" ? names.columns[0]!.names : []).toEqual(["Oscar Sillitto", "Plus One"]);
  });

  it("builds the honeymoon from suppliers and payments, with money flagged", () => {
    const hm = byKey("honeymoon")!;
    expect(hm.intro).toBe("Devon Dens.");
    expect(hm.blocks.some((b) => b.kind === "paragraph")).toBe(true);
    const moneyCards = hm.blocks.find((b) => b.kind === "cards" && b.money);
    expect(moneyCards).toBeDefined();
  });

  it("includes only AI threads with a real exchange and keeps the cost chapter money-only", () => {
    const chats = byKey("chats")!;
    const chat = chats.blocks[0]!;
    expect(chat.kind === "chat" ? chat.exchanges.length : 0).toBe(1);
    const cost = byKey("cost")!;
    expect(cost.money).toBe(true);
    expect(data.moneyIncluded).toBe(true);
  });

  it("drops the cost chapter and money stat when there is no budget", () => {
    const noBudget = assembleMemoryBook({ ...fixture(), budget: null }, META);
    expect(noBudget.chapters.some((c) => c.key === "cost")).toBe(false);
    expect(noBudget.moneyIncluded).toBe(false);
  });

  it("every chapter has a complete photo slot spec with empty photos", () => {
    for (const c of data.chapters) {
      for (const p of c.photos) expect(p.photo).toBeNull();
    }
  });
});
