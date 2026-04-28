import { describe, expect, it } from "vitest";
import {
  decideRateLimit,
  RATE_LIMIT_MAX_PER_EMAIL,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/rate-limit";

const NOW = new Date("2026-04-28T10:00:00.000Z");

describe("decideRateLimit", () => {
  it("allows when no attempts yet", () => {
    const r = decideRateLimit({
      attemptsInWindow: 0,
      oldestAttemptInWindow: null,
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBe(RATE_LIMIT_MAX_PER_EMAIL - 1);
  });

  it("allows when below the threshold", () => {
    const r = decideRateLimit({
      attemptsInWindow: 3,
      oldestAttemptInWindow: new Date(NOW.getTime() - 5_000),
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBe(RATE_LIMIT_MAX_PER_EMAIL - 4);
  });

  it("allows the exact (max-1)th attempt", () => {
    const r = decideRateLimit({
      attemptsInWindow: RATE_LIMIT_MAX_PER_EMAIL - 1,
      oldestAttemptInWindow: new Date(NOW.getTime() - 100),
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBe(0);
  });

  it("blocks at exactly the threshold", () => {
    const r = decideRateLimit({
      attemptsInWindow: RATE_LIMIT_MAX_PER_EMAIL,
      oldestAttemptInWindow: new Date(NOW.getTime() - 100),
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("email_quota_exceeded");
  });

  it("blocks above the threshold", () => {
    const r = decideRateLimit({
      attemptsInWindow: RATE_LIMIT_MAX_PER_EMAIL + 5,
      oldestAttemptInWindow: new Date(NOW.getTime() - 100),
      now: NOW,
    });
    expect(r.ok).toBe(false);
  });

  it("retryAfter computes from when the oldest attempt rolls out of the window", () => {
    const oldest = new Date(NOW.getTime() - 30 * 60 * 1000); // 30 min ago
    const r = decideRateLimit({
      attemptsInWindow: RATE_LIMIT_MAX_PER_EMAIL,
      oldestAttemptInWindow: oldest,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // window is 1h; oldest is 30m old → retryAfter ≈ 30 min = 1800s
      expect(r.retryAfterSec).toBeGreaterThanOrEqual(1799);
      expect(r.retryAfterSec).toBeLessThanOrEqual(1801);
    }
  });

  it("retryAfter is 0 when oldest is exactly at the window edge", () => {
    const oldest = new Date(NOW.getTime() - RATE_LIMIT_WINDOW_MS);
    const r = decideRateLimit({
      attemptsInWindow: RATE_LIMIT_MAX_PER_EMAIL,
      oldestAttemptInWindow: oldest,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBe(0);
  });

  it("falls back to a full-window wait when blocked but oldest is missing", () => {
    const r = decideRateLimit({
      attemptsInWindow: RATE_LIMIT_MAX_PER_EMAIL + 3,
      oldestAttemptInWindow: null,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryAfterSec).toBe(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
    }
  });

  it("respects custom max + windowMs overrides", () => {
    const tighter = decideRateLimit({
      attemptsInWindow: 2,
      oldestAttemptInWindow: new Date(NOW.getTime() - 10_000),
      now: NOW,
      max: 2,
      windowMs: 60 * 1000,
    });
    expect(tighter.ok).toBe(false);

    const looser = decideRateLimit({
      attemptsInWindow: 100,
      oldestAttemptInWindow: new Date(NOW.getTime() - 10_000),
      now: NOW,
      max: 1000,
    });
    expect(looser.ok).toBe(true);
  });
});
