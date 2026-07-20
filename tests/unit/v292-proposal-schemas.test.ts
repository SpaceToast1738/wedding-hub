// v2.9.2: payload schemas + labels for the new/edited proposal kinds
// (src/lib/ai/proposals/schemas.ts). Focus: the nothing-to-change
// refinements, the new seating.table.update name/shape fields + the
// posX/posY pairing refine surviving them, budget.line.update's opt-in
// categoryId move, the nudge.send snapshot shape, the settings.update
// keep-vs-clear semantics, and every new kind resolving through
// schemaForKind / humanLabel / summariseProposal so the /ai review list
// can render it.

import { describe, expect, it } from "vitest";
import {
  budgetCategoryUpdateSchema,
  budgetLineUpdateSchema,
  humanLabel,
  nudgeSendSchema,
  schemaForKind,
  seatingPlanUpdateSchema,
  seatingTableUpdateSchema,
  settingsUpdateSchema,
  summariseProposal,
} from "@/lib/ai/proposals/schemas";

describe("seatingTableUpdateSchema — name + shape (v2.9.2)", () => {
  it("accepts a name-only or shape-only change", () => {
    expect(seatingTableUpdateSchema.safeParse({ tableId: "t1", name: "Top Table" }).success).toBe(
      true,
    );
    expect(seatingTableUpdateSchema.safeParse({ tableId: "t1", shape: "HEAD" }).success).toBe(true);
  });

  it("rejects an unknown shape", () => {
    expect(seatingTableUpdateSchema.safeParse({ tableId: "t1", shape: "OVAL" }).success).toBe(false);
  });

  it("still refuses a lone posX/posY (pairing refine survives the new fields)", () => {
    expect(
      seatingTableUpdateSchema.safeParse({ tableId: "t1", name: "A", posX: 100 }).success,
    ).toBe(false);
    expect(
      seatingTableUpdateSchema.safeParse({ tableId: "t1", posX: 100, posY: 200 }).success,
    ).toBe(true);
  });
});

describe("budgetLineUpdateSchema — categoryId move (v2.9.2)", () => {
  it("accepts an opt-in categoryId and still allows omitting it", () => {
    expect(
      budgetLineUpdateSchema.safeParse({ lineId: "l1", categoryId: "c2" }).success,
    ).toBe(true);
    const kept = budgetLineUpdateSchema.parse({ lineId: "l1", description: "Flowers" });
    expect("categoryId" in kept).toBe(false);
  });
});

describe("nudgeSendSchema", () => {
  it("requires a valid digestKind and a count; defaults the display arrays", () => {
    expect(nudgeSendSchema.safeParse({ digestKind: "weekly", count: 1 }).success).toBe(false);
    const parsed = nudgeSendSchema.parse({ digestKind: "rsvp", count: 3 });
    expect(parsed.recipients).toEqual([]);
    expect(parsed.preview).toEqual([]);
  });
});

describe("settingsUpdateSchema", () => {
  it("requires at least one of weddingDate / aiMonthlyCapPence", () => {
    expect(settingsUpdateSchema.safeParse({}).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ weddingDate: "2026-10-01" }).success).toBe(true);
  });

  it("keeps null cap (clear) distinct from omitted (keep)", () => {
    const cleared = settingsUpdateSchema.parse({ aiMonthlyCapPence: null });
    expect(cleared.aiMonthlyCapPence).toBeNull();
    const set = settingsUpdateSchema.parse({ aiMonthlyCapPence: 5000 });
    expect(set.aiMonthlyCapPence).toBe(5000);
    // Over the £10,000 cap is rejected.
    expect(settingsUpdateSchema.safeParse({ aiMonthlyCapPence: 1_000_001 }).success).toBe(false);
  });
});

describe("budgetCategoryUpdateSchema", () => {
  it("requires categoryId and a non-empty name", () => {
    expect(budgetCategoryUpdateSchema.safeParse({ categoryId: "c1" }).success).toBe(false);
    expect(budgetCategoryUpdateSchema.safeParse({ categoryId: "c1", name: "" }).success).toBe(false);
    expect(
      budgetCategoryUpdateSchema.safeParse({ categoryId: "c1", name: "Flowers" }).success,
    ).toBe(true);
  });
});

describe("seatingPlanUpdateSchema", () => {
  it("requires at least one of notes / checklist and keeps null distinct from omitted", () => {
    expect(seatingPlanUpdateSchema.safeParse({}).success).toBe(false);
    const cleared = seatingPlanUpdateSchema.parse({ notes: null });
    expect(cleared.notes).toBeNull();
    expect("checklist" in cleared).toBe(false);
    const list = seatingPlanUpdateSchema.parse({
      checklist: [{ id: "a", label: "Place cards", done: false }],
    });
    expect(list.checklist).toHaveLength(1);
  });
});

describe("kind wiring (v2.9.2)", () => {
  const KINDS = [
    "nudge.send",
    "settings.update",
    "budget.category.update",
    "seating.plan.update",
  ] as const;

  it("every new kind resolves a schema and a label", () => {
    for (const kind of KINDS) {
      expect(schemaForKind(kind), kind).not.toBeNull();
      expect(humanLabel(kind), kind).toBeTruthy();
    }
  });

  it("summaries are non-empty and flag the risky bits", () => {
    const nudge = summariseProposal("nudge.send", {
      digestKind: "rsvp",
      recipients: ["jamie@example.com", "planner@example.com"],
      count: 4,
    });
    expect(nudge).toContain("EMAILS");
    expect(nudge).toContain("jamie@example.com");

    const settings = summariseProposal("settings.update", { weddingDate: "2026-10-01" });
    expect(settings).toContain("ripples");

    expect(summariseProposal("budget.category.update", { categoryId: "c1", name: "Flowers" })).toContain(
      "Flowers",
    );

    const plan = summariseProposal("seating.plan.update", {
      notes: null,
      checklist: [{ id: "a", label: "x", done: false }],
    });
    expect(plan).toContain("clears plan notes");
    expect(plan).toContain("checklist");
  });

  it("seating.table.update summary mentions a name/shape change", () => {
    const s = summariseProposal("seating.table.update", { tableId: "t1", name: "Top Table", shape: "HEAD" });
    expect(s).toContain("Top Table");
    expect(s).toContain("HEAD");
  });
});
