import { describe, expect, it } from "vitest";
import {
  nextLegalDeadlines,
  nextOutfitMilestones,
  oldestOpenDecisions,
} from "@/lib/today-widgets";

// v1.37.5: pure rollups powering the Today page's three new widgets.
// nextLegalDeadlines folds card-level dueByDate + per-item expiresAt
// into a single soonest-first list; nextOutfitMilestones expands each
// OUTFIT card's three dates into separate hits; oldestOpenDecisions
// takes a Task list and filters / sorts.

describe("nextLegalDeadlines", () => {
  const now = new Date("2026-08-01T00:00:00Z");

  it("returns empty for no cards", () => {
    expect(nextLegalDeadlines([], now, 30)).toEqual([]);
  });

  it("includes a card whose dueByDate falls in the window when items aren't fully obtained", () => {
    const r = nextLegalDeadlines(
      [
        {
          cardId: "c1",
          cardTitle: "Notice of Marriage",
          sectionSlug: "legal-before",
          subsectionSlug: "notice-of-marriage",
          dueByDate: new Date("2026-08-15T00:00:00Z"),
          items: [{ id: "i1", label: "Bryony", obtained: false }],
        },
      ],
      now,
      30,
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.kind).toBe("card");
    expect(r[0]!.cardTitle).toBe("Notice of Marriage");
    if (r[0]!.kind === "card") expect(r[0]!.daysToDue).toBe(14);
  });

  it("excludes a card whose dueByDate is in the window but every item is obtained", () => {
    const r = nextLegalDeadlines(
      [
        {
          cardId: "c1",
          cardTitle: "Already done",
          sectionSlug: "legal-before",
          subsectionSlug: "x",
          dueByDate: new Date("2026-08-15T00:00:00Z"),
          items: [{ id: "i1", label: "Bryony", obtained: true }],
        },
      ],
      now,
      30,
    );
    expect(r).toEqual([]);
  });

  it("includes per-item expiresAt within the window", () => {
    const r = nextLegalDeadlines(
      [
        {
          cardId: "c1",
          cardTitle: "Required documents",
          sectionSlug: "legal-before",
          subsectionSlug: "required-documents",
          items: [
            {
              id: "i1",
              label: "Passport — Bryony",
              obtained: false,
              expiresAt: new Date("2026-08-25T00:00:00Z"),
            },
          ],
        },
      ],
      now,
      30,
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.kind).toBe("item");
    if (r[0]!.kind === "item") {
      expect(r[0]!.itemLabel).toBe("Passport — Bryony");
      expect(r[0]!.daysToDue).toBe(24);
    }
  });

  it("includes overdue items + cards (negative daysToDue)", () => {
    const r = nextLegalDeadlines(
      [
        {
          cardId: "c1",
          cardTitle: "Overdue thing",
          sectionSlug: "legal-before",
          subsectionSlug: "x",
          dueByDate: new Date("2026-07-25T00:00:00Z"),
          items: [{ id: "i1", label: "x", obtained: false }],
        },
      ],
      now,
      30,
    );
    expect(r).toHaveLength(1);
    if (r[0]!.kind === "card") {
      expect(r[0]!.isOverdue).toBe(true);
      expect(r[0]!.daysToDue).toBe(-7);
    }
  });

  it("sorts soonest-first across cards + items", () => {
    const r = nextLegalDeadlines(
      [
        {
          cardId: "c1",
          cardTitle: "B",
          sectionSlug: "x",
          subsectionSlug: "x",
          dueByDate: new Date("2026-08-20T00:00:00Z"),
          items: [{ id: "i1", label: "early item", obtained: false, expiresAt: new Date("2026-08-05T00:00:00Z") }],
        },
        {
          cardId: "c2",
          cardTitle: "A",
          sectionSlug: "x",
          subsectionSlug: "x",
          dueByDate: new Date("2026-08-10T00:00:00Z"),
          items: [{ id: "i2", label: "x", obtained: false }],
        },
      ],
      now,
      30,
    );
    expect(r.map((h) => h.date.toISOString())).toEqual([
      "2026-08-05T00:00:00.000Z",
      "2026-08-10T00:00:00.000Z",
      "2026-08-20T00:00:00.000Z",
    ]);
  });
});

describe("nextOutfitMilestones", () => {
  const now = new Date("2026-08-01T00:00:00Z");

  it("returns empty when no dates set", () => {
    expect(
      nextOutfitMilestones(
        [
          {
            cardId: "o1",
            personName: "Bryony",
            sectionSlug: "wedding-party-people",
            subsectionSlug: "bryony-outfit",
            subsectionTitle: "Bryony — outfit",
          },
        ],
        now,
        30,
      ),
    ).toEqual([]);
  });

  it("expands each card into one hit per future-window milestone", () => {
    const r = nextOutfitMilestones(
      [
        {
          cardId: "o1",
          personName: "Bryony",
          sectionSlug: "wedding-party-people",
          subsectionSlug: "bryony-outfit",
          subsectionTitle: "Bryony — outfit",
          fittingDate: new Date("2026-08-05T00:00:00Z"),
          alterationsDueBy: new Date("2026-08-12T00:00:00Z"),
          pickupDate: new Date("2026-08-25T00:00:00Z"),
        },
      ],
      now,
      30,
    );
    expect(r).toHaveLength(3);
    expect(r.map((h) => h.milestone)).toEqual(["Fitting", "Alterations", "Pickup"]);
  });

  it("excludes past milestones (already happened)", () => {
    const r = nextOutfitMilestones(
      [
        {
          cardId: "o1",
          personName: "Bryony",
          sectionSlug: "x",
          subsectionSlug: "x",
          subsectionTitle: "x",
          fittingDate: new Date("2026-07-20T00:00:00Z"), // past
          alterationsDueBy: new Date("2026-08-12T00:00:00Z"),
        },
      ],
      now,
      30,
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.milestone).toBe("Alterations");
  });

  it("excludes milestones beyond the window", () => {
    const r = nextOutfitMilestones(
      [
        {
          cardId: "o1",
          personName: "Bryony",
          sectionSlug: "x",
          subsectionSlug: "x",
          subsectionTitle: "x",
          fittingDate: new Date("2026-09-15T00:00:00Z"), // 45d > 30d window
        },
      ],
      now,
      30,
    );
    expect(r).toEqual([]);
  });

  it("falls back to subsectionTitle when personName is empty", () => {
    const r = nextOutfitMilestones(
      [
        {
          cardId: "o1",
          personName: null,
          sectionSlug: "x",
          subsectionSlug: "x",
          subsectionTitle: "Mystery person — outfit",
          fittingDate: new Date("2026-08-15T00:00:00Z"),
        },
      ],
      now,
      30,
    );
    expect(r[0]!.personName).toBe("Mystery person — outfit");
  });

  it("sorts by date ascending across cards", () => {
    const r = nextOutfitMilestones(
      [
        {
          cardId: "a",
          personName: "Aimee",
          sectionSlug: "x",
          subsectionSlug: "x",
          subsectionTitle: "x",
          pickupDate: new Date("2026-08-20T00:00:00Z"),
        },
        {
          cardId: "b",
          personName: "Bryony",
          sectionSlug: "x",
          subsectionSlug: "x",
          subsectionTitle: "x",
          fittingDate: new Date("2026-08-05T00:00:00Z"),
        },
      ],
      now,
      30,
    );
    expect(r.map((h) => h.personName)).toEqual(["Bryony", "Aimee"]);
  });
});

describe("oldestOpenDecisions", () => {
  const tasks = [
    {
      id: "t1",
      title: "Pick a baker",
      type: "DECISION",
      status: "OPEN",
      createdAt: new Date("2026-04-01T00:00:00Z"),
      dueDate: new Date("2026-08-15T00:00:00Z"),
    },
    {
      id: "t2",
      title: "Meal options",
      type: "DECISION",
      status: "OPEN",
      createdAt: new Date("2026-03-20T00:00:00Z"),
      dueDate: null,
    },
    {
      id: "t3",
      title: "Closed already",
      type: "DECISION",
      status: "DONE",
      createdAt: new Date("2026-02-10T00:00:00Z"),
      dueDate: null,
    },
    {
      id: "t4",
      title: "Not a decision",
      type: "TASK",
      status: "OPEN",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      dueDate: null,
    },
    {
      id: "t5",
      title: "Earliest date",
      type: "DECISION",
      status: "IN_PROGRESS",
      createdAt: new Date("2026-04-15T00:00:00Z"),
      dueDate: new Date("2026-08-01T00:00:00Z"),
    },
  ];

  it("filters out non-DECISION + closed statuses", () => {
    const r = oldestOpenDecisions(tasks, 10);
    expect(r.map((t) => t.id).sort()).toEqual(["t1", "t2", "t5"]);
  });

  it("sorts: dated soonest first, then undated by creation oldest first", () => {
    const r = oldestOpenDecisions(tasks, 10);
    expect(r.map((t) => t.id)).toEqual(["t5", "t1", "t2"]);
  });

  it("respects the limit", () => {
    const r = oldestOpenDecisions(tasks, 2);
    expect(r).toHaveLength(2);
    expect(r.map((t) => t.id)).toEqual(["t5", "t1"]);
  });
});
