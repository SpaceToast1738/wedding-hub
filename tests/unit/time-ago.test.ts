import { describe, expect, it } from "vitest";
import { timeAgo } from "@/lib/time-ago";

const NOW = new Date("2026-04-30T12:00:00Z");

const at = (offsetMs: number): Date => new Date(NOW.getTime() - offsetMs);

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

describe("timeAgo", () => {
  it("returns 'just now' for sub-30-second deltas", () => {
    expect(timeAgo(at(0), NOW)).toBe("just now");
    expect(timeAgo(at(15 * SEC), NOW)).toBe("just now");
    expect(timeAgo(at(29 * SEC), NOW)).toBe("just now");
  });

  it("returns 'just now' for future timestamps (clock skew)", () => {
    expect(timeAgo(new Date(NOW.getTime() + 5 * SEC), NOW)).toBe("just now");
  });

  it("returns seconds for 30-59s deltas", () => {
    expect(timeAgo(at(35 * SEC), NOW)).toBe("35 sec ago");
    expect(timeAgo(at(59 * SEC), NOW)).toBe("59 sec ago");
  });

  it("returns minutes for 1-59 min deltas", () => {
    expect(timeAgo(at(MIN), NOW)).toBe("1 min ago");
    expect(timeAgo(at(5 * MIN), NOW)).toBe("5 min ago");
    expect(timeAgo(at(59 * MIN), NOW)).toBe("59 min ago");
  });

  it("returns hours for 1-23 hr deltas", () => {
    expect(timeAgo(at(HOUR), NOW)).toBe("1 hr ago");
    expect(timeAgo(at(8 * HOUR), NOW)).toBe("8 hr ago");
    expect(timeAgo(at(23 * HOUR), NOW)).toBe("23 hr ago");
  });

  it("returns 'yesterday' for 1-2 day deltas", () => {
    expect(timeAgo(at(DAY), NOW)).toBe("yesterday");
    expect(timeAgo(at(36 * HOUR), NOW)).toBe("yesterday");
    expect(timeAgo(at(2 * DAY - 1), NOW)).toBe("yesterday");
  });

  it("returns days for 2-6 day deltas", () => {
    expect(timeAgo(at(2 * DAY), NOW)).toBe("2 days ago");
    expect(timeAgo(at(5 * DAY), NOW)).toBe("5 days ago");
    expect(timeAgo(at(6 * DAY), NOW)).toBe("6 days ago");
  });

  it("returns weeks for 1-5 week deltas", () => {
    expect(timeAgo(at(WEEK), NOW)).toBe("1 week ago");
    expect(timeAgo(at(2 * WEEK), NOW)).toBe("2 weeks ago");
    expect(timeAgo(at(5 * WEEK), NOW)).toBe("5 weeks ago");
  });

  it("falls through to a short date past 6 weeks", () => {
    const result = timeAgo(at(8 * WEEK), NOW);
    // Should be a date string like "5 Mar" (en-GB short format).
    expect(result).toMatch(/^\d{1,2}\s\w+$/);
    // Must NOT be a "X weeks ago" sentence.
    expect(result).not.toMatch(/weeks?\s+ago/);
  });
});
