import { describe, expect, it } from "vitest";
import {
  computeActual,
  computeCompositeActual,
  computeCompositePaid,
  computeEstimated,
  computeComponentEstimated,
  computePaid,
  isManualOverride,
  sumOfPayments,
} from "@/lib/budget";

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

// v1.86.0: fund-filter semantics on the compute helpers.
describe("compute* — v1.86.0 fund-filter semantics", () => {
  it("computeActual returns 0 when line fund doesn't match filter and override is set", () => {
    const result = computeActual(
      {
        actual: dec(500),
        payments: [],
        fundSource: "JOINT",
      },
      { fund: "PERSONAL_BRIDE" },
    );
    expect(result).toBe(0);
  });

  it("computeActual returns override when line fund matches filter", () => {
    const result = computeActual(
      { actual: dec(500), payments: [], fundSource: "JOINT" },
      { fund: "JOINT" },
    );
    expect(result).toBe(500);
  });

  it("computeActual sums only payments whose effective fund matches", () => {
    const result = computeActual(
      {
        actual: null,
        payments: [
          { amount: dec(100), fundSource: "JOINT" },
          { amount: dec(200), fundSource: "OTHER" },
          { amount: dec(50), fundSource: null }, // inherits line
        ],
        fundSource: "JOINT",
      },
      { fund: "JOINT" },
    );
    // £100 (own JOINT) + £50 (inherited JOINT) = £150. £200 excluded.
    expect(result).toBe(150);
  });

  it("computePaid filters by fund AND PAID status", () => {
    const result = computePaid(
      {
        paid: null,
        payments: [
          { amount: dec(100), status: "PAID", fundSource: "JOINT" },
          { amount: dec(50), status: "DUE", fundSource: "JOINT" }, // wrong status
          { amount: dec(200), status: "PAID", fundSource: "OTHER" }, // wrong fund
        ],
        fundSource: "JOINT",
      },
      { fund: "JOINT" },
    );
    expect(result).toBe(100);
  });

  it("computeEstimated returns 0 when line fund doesn't match", () => {
    const result = computeEstimated(
      {
        estimated: dec(5000),
        perHeadPence: null,
        headcountSource: null,
        fundSource: "PERSONAL_BRIDE",
      },
      null,
      { fund: "JOINT" },
    );
    expect(result).toBe(0);
  });

  it("computeEstimated returns full estimate when filter matches", () => {
    const result = computeEstimated(
      {
        estimated: dec(5000),
        perHeadPence: null,
        headcountSource: null,
        fundSource: "JOINT",
      },
      null,
      { fund: "JOINT" },
    );
    expect(result).toBe(5000);
  });

  it("computeComponentEstimated uses parent line fund when component fund is null", () => {
    const result = computeComponentEstimated(
      {
        flatPence: 15000,
        perHeadPence: null,
        headcountSource: null,
        fundSource: null,
      },
      null,
      { fund: "JOINT" },
      { fundSource: "JOINT", fundLabel: null },
    );
    expect(result).toBe(150);
  });

  it("computeComponentEstimated own fund overrides parent line", () => {
    const result = computeComponentEstimated(
      {
        flatPence: 15000,
        perHeadPence: null,
        headcountSource: null,
        fundSource: "OTHER",
      },
      null,
      { fund: "JOINT" }, // filter
      { fundSource: "JOINT", fundLabel: null }, // parent
    );
    // Component overrides to OTHER, filter is JOINT → 0.
    expect(result).toBe(0);
  });

  it("computeCompositeActual sums line + component payments by fund", () => {
    const result = computeCompositeActual(
      {
        actual: null,
        fundSource: "JOINT",
        payments: [{ amount: dec(1000), fundSource: null }], // inherits JOINT
        components: [
          {
            fundSource: "OTHER", // override
            payments: [{ amount: dec(500), fundSource: null }], // inherits OTHER
          },
          {
            fundSource: null, // inherits JOINT
            payments: [{ amount: dec(300), fundSource: null }],
          },
        ],
      },
      { fund: "JOINT" },
    );
    // Line £1000 + 2nd component £300 = £1300. £500 OTHER excluded.
    expect(result).toBe(1300);
  });

  it("computeCompositePaid filter+PAID+fund stack works", () => {
    const result = computeCompositePaid(
      {
        paid: null,
        fundSource: "JOINT",
        payments: [
          { amount: dec(1000), status: "PAID", fundSource: null },
          { amount: dec(200), status: "DUE", fundSource: null },
        ],
        components: [
          {
            fundSource: "OTHER",
            payments: [{ amount: dec(500), status: "PAID", fundSource: null }],
          },
        ],
      },
      { fund: "JOINT" },
    );
    // Only line's £1000 PAID matches (DUE wrong status, OTHER wrong fund).
    expect(result).toBe(1000);
  });

  it("filter ALL behaves like no filter", () => {
    const lineNoFilter = computeActual({
      actual: null,
      payments: [
        { amount: dec(100), fundSource: "JOINT" },
        { amount: dec(200), fundSource: "OTHER" },
      ],
      fundSource: "JOINT",
    });
    const lineAllFilter = computeActual(
      {
        actual: null,
        payments: [
          { amount: dec(100), fundSource: "JOINT" },
          { amount: dec(200), fundSource: "OTHER" },
        ],
        fundSource: "JOINT",
      },
      { fund: "ALL" },
    );
    expect(lineNoFilter).toBe(300);
    expect(lineAllFilter).toBe(300);
  });

  it("UNASSIGNED filter matches rows with no fund anywhere", () => {
    const result = computeActual(
      {
        actual: null,
        payments: [
          { amount: dec(100), fundSource: null },
          { amount: dec(200), fundSource: "JOINT" },
        ],
        fundSource: null, // unassigned
      },
      { fund: "UNASSIGNED" },
    );
    expect(result).toBe(100);
  });
});
