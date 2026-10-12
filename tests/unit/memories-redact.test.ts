import { describe, expect, it } from "vitest";
import { assembleMemoryBook } from "@/lib/memories/assemble";
import { redactMoney } from "@/lib/memories/redact";
import { fixture } from "./memories-fixture";

const META = { appVersion: "2.17.0", generatedAt: "2026-10-12T09:00:00.000Z" };

function hasMoney(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasMoney);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.money === true) return true;
    return Object.values(o).some(hasMoney);
  }
  return false;
}

describe("redactMoney", () => {
  it("removes every money-flagged chapter, block, item and highlight", () => {
    const full = assembleMemoryBook(fixture(), META);
    expect(hasMoney(full)).toBe(true);
    const out = redactMoney(full);
    expect(out.moneyIncluded).toBe(false);
    expect(hasMoney(out)).toBe(false);
    expect(out.chapters.some((c) => c.key === "cost")).toBe(false);
  });

  it("keeps everything else byte-identical and renumbers nothing", () => {
    const full = assembleMemoryBook(fixture(), META);
    const out = redactMoney(full);
    expect(out.chapters.map((c) => c.key)).toEqual(full.chapters.filter((c) => !c.money).map((c) => c.key));
    const people = out.chapters.find((c) => c.key === "people")!;
    const original = full.chapters.find((c) => c.key === "people")!;
    expect(people).toEqual(original);
    // Non-mutating.
    expect(hasMoney(full)).toBe(true);
  });

  it("is a no-op when the book never had money", () => {
    const none = assembleMemoryBook({ ...fixture(), budget: null }, META);
    expect(redactMoney(none)).toBe(none);
  });
});
