import { describe, expect, it } from "vitest";
import { groupByBatch } from "@/lib/ai/proposals/grouping";

const row = (id: string, batchId: string | null) => ({ id, batchId });

describe("groupByBatch", () => {
  it("null batchId rows become singleton groups", () => {
    const groups = groupByBatch([row("a", null), row("b", null)]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ key: "single:a", batchId: null, items: [row("a", null)] });
    expect(groups[1]).toEqual({ key: "single:b", batchId: null, items: [row("b", null)] });
  });

  it("rows sharing a batchId collapse into one group", () => {
    const groups = groupByBatch([row("a", "b1"), row("b", "b1"), row("c", "b1")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("b1");
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("groups keep first-seen order among mixed rows", () => {
    const groups = groupByBatch([
      row("a", "b1"),
      row("b", null),
      row("c", "b2"),
      row("d", "b1"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["b1", "single:b", "b2"]);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["a", "d"]);
  });

  it("empty input → empty output", () => {
    expect(groupByBatch([])).toEqual([]);
  });
});
