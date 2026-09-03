// v2.16.0: RUNSHEET card kind — the pure parts: free-text time parsing
// + sort, rollups, the proposal payload schema, and the share/export
// Doc rendering.

import { describe, expect, it } from "vitest";
import { parseRunsheetTime, runsheetRollups, sortRowsByTime } from "@/lib/book-cards";
import { bookRunsheetUpdateSchema } from "@/lib/ai/proposals/schemas";
import { cardToDoc, docToWhatsApp } from "@/lib/book-card-doc";

describe("parseRunsheetTime — free text, wedding-day heuristic", () => {
  it.each([
    ["12:45", 12 * 60 + 45],
    ["1:35", 13 * 60 + 35], // bare 1–7 is the afternoon
    ["1:35/1:45", 13 * 60 + 35], // first time wins
    ["2:00", 14 * 60],
    ["9:00", 9 * 60], // 8–12 literal (morning setup)
    ["2pm", 14 * 60],
    ["11am", 11 * 60],
    ["12am", 0],
    ["14:00", 14 * 60],
    ["~2:10 rings", 14 * 60 + 10],
  ])("%s → %d", (input, minutes) => {
    expect(parseRunsheetTime(input)).toBe(minutes);
  });

  it("returns null for text with no time, empty, or nonsense", () => {
    expect(parseRunsheetTime("after speeches")).toBeNull();
    expect(parseRunsheetTime("")).toBeNull();
    expect(parseRunsheetTime(null)).toBeNull();
    expect(parseRunsheetTime("25:99")).toBeNull();
  });
});

describe("sortRowsByTime", () => {
  it("orders parsable times, keeps unparsable rows in place at the end, stable", () => {
    const rows = [
      { id: "a", time: "2:00" },
      { id: "b", time: "after speeches" },
      { id: "c", time: "12:45" },
      { id: "d", time: null },
      { id: "e", time: "1:35" },
      { id: "f", time: "12:45" },
    ];
    expect(sortRowsByTime(rows).map((r) => r.id)).toEqual(["c", "f", "e", "a", "b", "d"]);
  });
});

describe("runsheetRollups", () => {
  it("counts done rows and rounds the percentage; empty is 0%", () => {
    expect(runsheetRollups({ rows: [] })).toEqual({ rowCount: 0, doneCount: 0, percentDone: 0 });
    expect(
      runsheetRollups({
        rows: [
          { time: null, done: true },
          { time: null, done: false },
          { time: null, done: false },
        ],
      }),
    ).toEqual({ rowCount: 3, doneCount: 1, percentDone: 33 });
  });
});

describe("bookRunsheetUpdateSchema", () => {
  it("accepts row deltas and defaults done=false on adds", () => {
    const r = bookRunsheetUpdateSchema.safeParse({
      subsectionId: "cmsz1m4ip0043ry9hblegxvn3",
      addRows: [{ time: "12:45", event: "Groomsmen chair sweep", owner: "Josh" }],
      updateRows: [{ rowId: "cmsz1m4ip0043ry9hblegxvn4", done: true }],
      removeRowIds: ["cmsz1m4ip0043ry9hblegxvn5"],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.addRows?.[0]?.done).toBe(false);
    expect(r.data.updateRows?.[0]?.event).toBeUndefined();
  });

  it("rejects an added row without an event", () => {
    const r = bookRunsheetUpdateSchema.safeParse({
      subsectionId: "cmsz1m4ip0043ry9hblegxvn3",
      addRows: [{ time: "12:45" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("RUNSHEET → Doc → WhatsApp", () => {
  it("renders intro notes then one bullet per row: bold time, event, owner, notes, tick when done", () => {
    const wa = docToWhatsApp(
      cardToDoc({
        id: "card_1",
        slug: "ceremony-running-order",
        title: "The Ceremony — running order",
        visibility: "EVERYONE",
        sectionSlug: "ceremony-music",
        sectionTitle: "Ceremony & Music",
        kind: "RUNSHEET",
        notes: "Registrar interviews are in the Garden Room.",
        rows: [
          { time: "12:45", event: "Groomsmen chair sweep", owner: "Josh", notes: null, done: true },
          { time: "1:50", event: "Coast-clear signal", owner: "Josh", notes: "thumbs up from the door", done: false },
          { time: null, event: "Walk out", owner: null, notes: null, done: false },
        ],
      }),
    );
    expect(wa).toContain("Registrar interviews are in the Garden Room.");
    expect(wa).toContain("• ☑ *12:45* — Groomsmen chair sweep (Josh)");
    expect(wa).toContain("• *1:50* — Coast-clear signal (Josh) · thumbs up from the door");
    expect(wa).toContain("• Walk out");
  });
});
