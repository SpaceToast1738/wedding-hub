import { describe, expect, it } from "vitest";
import { formatWeddingDate, formatWeddingDateShort, type WeddingSettings } from "@/lib/wedding-settings";

const sample: WeddingSettings = {
  weddingDate: new Date("2026-09-26T14:00:00Z"),
  ceremonyTime: "2:00pm ceremony",
  venue: "Alveston Manor",
  venueAddress: "Stratford-upon-Avon",
  coupleLabel: "Spencer · Olwyn-Davis Wedding",
  coupleShort: "Jamie & Bryony's Wedding",
  brideFirst: "Bryony",
  groomFirst: "Jamie",
  seatingNotes: null,
  seatingChecklist: null,
};

describe("formatWeddingDate — v1.20.0", () => {
  it("renders en-GB long form", () => {
    const out = formatWeddingDate(sample);
    // Day + month + year always present; locale formatting may vary slightly
    // by Node's ICU build. Assert on stable substrings.
    expect(out).toMatch(/26/);
    expect(out).toMatch(/September/);
    expect(out).toMatch(/2026/);
  });
});

describe("formatWeddingDateShort — v1.20.0", () => {
  it("renders en-GB short form (Sep abbreviation)", () => {
    const out = formatWeddingDateShort(sample);
    expect(out).toMatch(/26/);
    expect(out).toMatch(/Sep/);
    expect(out).toMatch(/2026/);
  });
});
