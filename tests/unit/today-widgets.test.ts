import { describe, expect, it } from "vitest";
import { oldestOpenDecisions } from "@/lib/today-widgets";

// v1.37.5: pure rollups powering the Today page's widgets.
// v1.93.0: nextOutfitMilestones retired — OUTFIT cards no longer
// carry fitting / alterations / pickup dates.
// v2.0.0: nextLegalDeadlines retired with the LEGAL card kind.
// Only oldestOpenDecisions remains — takes a Task list, filters
// closed + non-DECISION rows, sorts dated-soonest then undated-
// oldest-by-creation.

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
