import { describe, expect, it } from "vitest";
import { computeActual, isManualOverride, sumOfPayments } from "@/lib/budget";

// Helpers — Prisma's Decimal serializes as a `{ toString(): string }`
// shape; we mimic that with bare strings for test ergonomics.
const dec = (v: number | null) => (v === null ? null : { toString: () => v.toFixed(2) });

describe("computeActual — B2 manual-override semantics", () => {
  it("returns the manual override when actual is non-null (£200, payments ignored)", () => {
    const result = computeActual({
      actual: dec(200),
      payments: [{ amount: dec(100) }, { amount: dec(50) }],
    });
    expect(result).toBe(200);
  });

  it("sums payments when actual is null (£100 + £50 = £150)", () => {
    const result = computeActual({
      actual: null,
      payments: [{ amount: dec(100) }, { amount: dec(50) }],
    });
    expect(result).toBe(150);
  });

  it("returns 0 when actual is null and payments is empty", () => {
    const result = computeActual({ actual: null, payments: [] });
    expect(result).toBe(0);
  });

  it("returns 0 when actual is null and payments contain only zero amounts", () => {
    const result = computeActual({
      actual: null,
      payments: [{ amount: dec(0) }, { amount: dec(0) }],
    });
    expect(result).toBe(0);
  });

  it("returns the override even when override is 0 (intentional 'free' override)", () => {
    const result = computeActual({
      actual: dec(0),
      payments: [{ amount: dec(500) }],
    });
    expect(result).toBe(0);
  });

  it("treats undefined like null (computes from payments)", () => {
    const result = computeActual({
      actual: undefined,
      payments: [{ amount: dec(75) }],
    });
    expect(result).toBe(75);
  });
});

describe("isManualOverride", () => {
  it("returns true when actual is non-null", () => {
    expect(isManualOverride({ actual: dec(100), payments: [] })).toBe(true);
  });

  it("returns false when actual is null", () => {
    expect(isManualOverride({ actual: null, payments: [{ amount: dec(50) }] })).toBe(false);
  });

  it("returns true even for £0 override (it's still a manual pin)", () => {
    expect(isManualOverride({ actual: dec(0), payments: [] })).toBe(true);
  });
});

describe("sumOfPayments", () => {
  it("sums all payment amounts regardless of override state", () => {
    const result = sumOfPayments({
      actual: dec(999),
      payments: [{ amount: dec(100) }, { amount: dec(200) }, { amount: dec(50) }],
    });
    expect(result).toBe(350);
  });

  it("returns 0 for empty payments", () => {
    expect(sumOfPayments({ actual: null, payments: [] })).toBe(0);
  });
});
