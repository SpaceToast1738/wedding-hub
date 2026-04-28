import { describe, expect, it } from "vitest";
import {
  coerceTaskType,
  coerceTaskPriority,
  coerceTaskStatus,
  coerceTaskDueDate,
  inferTaskMapping,
} from "@/lib/csv";

describe("coerceTaskType — v1.16.0", () => {
  it("maps task / todo / action to TASK", () => {
    expect(coerceTaskType("task")).toBe("TASK");
    expect(coerceTaskType("Todo")).toBe("TASK");
    expect(coerceTaskType("ACTION")).toBe("TASK");
  });

  it("maps question / q to QUESTION", () => {
    expect(coerceTaskType("question")).toBe("QUESTION");
    expect(coerceTaskType("Q")).toBe("QUESTION");
  });

  it("maps decision / decide / choice to DECISION", () => {
    expect(coerceTaskType("decision")).toBe("DECISION");
    expect(coerceTaskType("Choice")).toBe("DECISION");
  });

  it("falls back to TASK for empty / unknown", () => {
    expect(coerceTaskType("")).toBe("TASK");
    expect(coerceTaskType("???")).toBe("TASK");
  });
});

describe("coerceTaskPriority — v1.16.0", () => {
  it("maps standard priority words", () => {
    expect(coerceTaskPriority("low")).toBe("LOW");
    expect(coerceTaskPriority("Medium")).toBe("MEDIUM");
    expect(coerceTaskPriority("HIGH")).toBe("HIGH");
    expect(coerceTaskPriority("urgent")).toBe("URGENT");
  });

  it("accepts shorthands", () => {
    expect(coerceTaskPriority("L")).toBe("LOW");
    expect(coerceTaskPriority("med")).toBe("MEDIUM");
    expect(coerceTaskPriority("h")).toBe("HIGH");
    expect(coerceTaskPriority("critical")).toBe("URGENT");
  });

  it("falls back to MEDIUM", () => {
    expect(coerceTaskPriority("")).toBe("MEDIUM");
    expect(coerceTaskPriority("???")).toBe("MEDIUM");
  });
});

describe("coerceTaskStatus — v1.16.0", () => {
  it("maps standard statuses", () => {
    expect(coerceTaskStatus("open")).toBe("OPEN");
    expect(coerceTaskStatus("in progress")).toBe("IN_PROGRESS");
    expect(coerceTaskStatus("waiting")).toBe("WAITING");
    expect(coerceTaskStatus("done")).toBe("DONE");
    expect(coerceTaskStatus("archived")).toBe("ARCHIVED");
  });

  it("recognises common synonyms", () => {
    expect(coerceTaskStatus("doing")).toBe("IN_PROGRESS");
    expect(coerceTaskStatus("blocked")).toBe("WAITING");
    expect(coerceTaskStatus("completed")).toBe("DONE");
    expect(coerceTaskStatus("cancelled")).toBe("ARCHIVED");
  });

  it("falls back to OPEN", () => {
    expect(coerceTaskStatus("")).toBe("OPEN");
  });
});

describe("coerceTaskDueDate — v1.16.0", () => {
  it("parses ISO YYYY-MM-DD", () => {
    const d = coerceTaskDueDate("2026-09-26");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toMatch(/^2026-09-26/);
  });

  it("parses ISO timestamp", () => {
    const d = coerceTaskDueDate("2026-09-26T14:00:00Z");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-09-26T14:00:00.000Z");
  });

  it("parses UK-style DD/MM/YYYY", () => {
    const d = coerceTaskDueDate("26/09/2026");
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe("2026-09-26");
  });

  it("parses UK-style DD-MM-YYYY", () => {
    const d = coerceTaskDueDate("26-09-2026");
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe("2026-09-26");
  });

  it("returns null for unparseable input", () => {
    expect(coerceTaskDueDate("")).toBeNull();
    expect(coerceTaskDueDate("not a date")).toBeNull();
    expect(coerceTaskDueDate("Sept 26")).toBeNull();
  });
});

describe("inferTaskMapping — v1.16.0", () => {
  it("maps standard column names", () => {
    const headers = ["Title", "Type", "Priority", "Status", "Due", "Assignee", "Tags", "Notes"];
    expect(inferTaskMapping(headers)).toEqual([
      "title", "type", "priority", "status", "dueDate", "assigneeEmail", "tags", "notes",
    ]);
  });

  it("recognises synonyms", () => {
    const headers = ["Description", "Kind", "Urgency", "State", "Deadline", "Owner", "Labels", "Comments"];
    expect(inferTaskMapping(headers)).toEqual([
      "title", "type", "priority", "status", "dueDate", "assigneeEmail", "tags", "notes",
    ]);
  });

  it("returns 'ignore' for unknown columns", () => {
    expect(inferTaskMapping(["Foo", "Bar"])).toEqual(["ignore", "ignore"]);
  });

  it("doesn't double-assign — second 'title' column gets ignored", () => {
    const headers = ["Title", "Title"];
    expect(inferTaskMapping(headers)).toEqual(["title", "ignore"]);
  });
});
