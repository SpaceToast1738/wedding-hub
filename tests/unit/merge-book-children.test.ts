import { describe, expect, it } from "vitest";
import { mergeChildren } from "@/lib/ai/proposals/merge-book-children";

// Shapes mirror BookBuildMaterial-ish rows: mixed text, money, flags.
// costPence is the load-bearing field — the AI can never express it,
// so verbatim carry-through of unnamed rows is the money invariant.
const base = [
  { id: "m1", name: "Oak dowels", costPence: 12345, ordered: true, notes: "20mm" },
  { id: "m2", name: "Wood glue", costPence: null, ordered: false, notes: null },
  { id: "m3", name: "Brass hooks", costPence: 899, ordered: false, notes: "x40" },
];

describe("mergeChildren", () => {
  it("re-emits unnamed rows VERBATIM — every field, money included", () => {
    const next = mergeChildren(base, {
      update: [{ id: "m2", notes: "PVA, 1L" }],
    });
    expect(next[0]).toEqual({
      id: "m1",
      name: "Oak dowels",
      costPence: 12345,
      ordered: true,
      notes: "20mm",
    });
    expect(next[2]).toEqual({
      id: "m3",
      name: "Brass hooks",
      costPence: 899,
      ordered: false,
      notes: "x40",
    });
  });

  it("removeIds are the ONLY deletions — untouched rows never vanish", () => {
    const next = mergeChildren(base, { removeIds: ["m2"] });
    expect(next.map((r) => r.id)).toEqual(["m1", "m3"]);
    expect(next).toEqual([{ ...base[0] }, { ...base[2] }]);
  });

  it("patches DEFINED fields only: undefined keeps, explicit null clears", () => {
    const next = mergeChildren(base, {
      update: [{ id: "m1", notes: null, name: undefined, ordered: false }],
    });
    expect(next[0]).toEqual({
      id: "m1",
      name: "Oak dowels", // undefined in the patch → kept
      costPence: 12345, // never named → carried
      ordered: false, // patched
      notes: null, // explicit null → cleared
    });
  });

  it("a patch never touches fields it doesn't name (costPence survives)", () => {
    const next = mergeChildren(base, {
      update: [{ id: "m3", name: "Brass hooks (antique)" }],
    });
    expect(next[2]!.costPence).toBe(899);
    expect(next[2]!.ordered).toBe(false);
  });

  it("appends adds with generated new-N ids, discarding any caller-supplied id", () => {
    const next = mergeChildren(base, {
      add: [
        { name: "Sandpaper", notes: "120 grit" },
        { id: "sneaky-real-id", name: "Varnish" },
      ],
    });
    expect(next).toHaveLength(5);
    expect(next[3]).toEqual({ id: "new-0", name: "Sandpaper", notes: "120 grit" });
    expect(next[4]).toEqual({ id: "new-1", name: "Varnish" });
  });

  it("honours a custom newIdPrefix", () => {
    const next = mergeChildren(base, { add: [{ name: "Twine" }] }, { newIdPrefix: "tmp-" });
    expect(next[3]!.id).toBe("tmp-0");
  });

  it("throws on an update id that no longer exists (stale proposal)", () => {
    expect(() =>
      mergeChildren(base, { update: [{ id: "gone", name: "??" }] }),
    ).toThrow(/no longer exists.*re-read and re-propose/);
  });

  it("throws on a remove id that no longer exists (stale proposal)", () => {
    expect(() => mergeChildren(base, { removeIds: ["gone"] })).toThrow(
      /no longer exists.*re-read and re-propose/,
    );
  });

  it("preserves current order with mixed remove + update + add", () => {
    const next = mergeChildren(base, {
      removeIds: ["m1"],
      update: [{ id: "m3", ordered: true }],
      add: [{ name: "Labels" }],
    });
    expect(next.map((r) => r.id)).toEqual(["m2", "m3", "new-0"]);
    expect(next[1]!.ordered).toBe(true);
  });

  it("empty delta returns equal copies, not the same row objects", () => {
    const next = mergeChildren(base, {});
    expect(next).toEqual(base);
    expect(next[0]).not.toBe(base[0]);
  });
});
