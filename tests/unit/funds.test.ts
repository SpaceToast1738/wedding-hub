// v1.86.0: tests for the funding-source resolver. Pure-fn module so
// these run in pure vitest with no DB mocks.

import { describe, expect, it } from "vitest";
import {
  effectiveFundForComponent,
  effectiveFundForPayment,
  formatFundChip,
  groupTotalsByFund,
  resolveFundLabels,
  rowMatchesFundFilter,
} from "@/lib/funds";

describe("resolveFundLabels", () => {
  it("uses the couple's first names from WeddingSettings", () => {
    const labels = resolveFundLabels({ brideFirst: "Bryony", groomFirst: "Jamie" });
    expect(labels.PERSONAL_BRIDE).toBe("Bryony");
    expect(labels.PERSONAL_GROOM).toBe("Jamie");
    expect(labels.JOINT).toBe("Joint");
    expect(labels.OTHER).toBe("Other");
    expect(labels.UNASSIGNED).toBe("Unassigned");
  });

  it("falls back to 'Bride' / 'Groom' when settings are empty", () => {
    const labels = resolveFundLabels({ brideFirst: null, groomFirst: null });
    expect(labels.PERSONAL_BRIDE).toBe("Bride");
    expect(labels.PERSONAL_GROOM).toBe("Groom");
  });

  it("trims whitespace from the names", () => {
    const labels = resolveFundLabels({ brideFirst: "  ", groomFirst: " Jamie " });
    expect(labels.PERSONAL_BRIDE).toBe("Bride"); // whitespace-only treated as empty
    expect(labels.PERSONAL_GROOM).toBe("Jamie");
  });
});

describe("formatFundChip", () => {
  const labels = resolveFundLabels({ brideFirst: "Bryony", groomFirst: "Jamie" });

  it("returns the bucket name when fundLabel is null", () => {
    expect(formatFundChip("JOINT", null, labels)).toBe("Joint");
    expect(formatFundChip("UNASSIGNED", null, labels)).toBe("Unassigned");
  });

  it("appends a non-empty fundLabel after a colon", () => {
    expect(formatFundChip("OTHER", "Bryony's parents", labels)).toBe("Other: Bryony's parents");
    expect(formatFundChip("JOINT", "Monzo pot", labels)).toBe("Joint: Monzo pot");
  });

  it("ignores empty/whitespace-only labels", () => {
    expect(formatFundChip("OTHER", "   ", labels)).toBe("Other");
    expect(formatFundChip("OTHER", "", labels)).toBe("Other");
  });
});

describe("effectiveFundForComponent", () => {
  it("uses the component's own fund when set", () => {
    const res = effectiveFundForComponent(
      { fundSource: "OTHER", fundLabel: "parents" },
      { fundSource: "JOINT", fundLabel: null },
    );
    expect(res.fund).toBe("OTHER");
    expect(res.label).toBe("parents");
    expect(res.inherited).toBe(false);
  });

  it("inherits from the parent line when component is null", () => {
    const res = effectiveFundForComponent(
      { fundSource: null, fundLabel: null },
      { fundSource: "JOINT", fundLabel: "Monzo" },
    );
    expect(res.fund).toBe("JOINT");
    expect(res.label).toBe("Monzo");
    expect(res.inherited).toBe(true);
  });

  it("returns UNASSIGNED when both are null", () => {
    const res = effectiveFundForComponent(
      { fundSource: null, fundLabel: null },
      { fundSource: null, fundLabel: null },
    );
    expect(res.fund).toBe("UNASSIGNED");
    expect(res.label).toBe(null);
    expect(res.inherited).toBe(false);
  });
});

describe("effectiveFundForPayment", () => {
  it("payment own > component > line", () => {
    // payment overrides everything
    expect(
      effectiveFundForPayment(
        { fundSource: "PERSONAL_BRIDE", fundLabel: null },
        { fundSource: "OTHER", fundLabel: "x" },
        { fundSource: "JOINT", fundLabel: null },
      ).fund,
    ).toBe("PERSONAL_BRIDE");
  });

  it("falls through component before line", () => {
    expect(
      effectiveFundForPayment(
        { fundSource: null, fundLabel: null },
        { fundSource: "OTHER", fundLabel: "parents" },
        { fundSource: "JOINT", fundLabel: null },
      ),
    ).toEqual({ fund: "OTHER", label: "parents", inherited: true });
  });

  it("inherits from line when payment + component are null", () => {
    expect(
      effectiveFundForPayment(
        { fundSource: null, fundLabel: null },
        { fundSource: null, fundLabel: null },
        { fundSource: "JOINT", fundLabel: null },
      ).fund,
    ).toBe("JOINT");
  });

  it("handles missing component (payment linked to line only)", () => {
    expect(
      effectiveFundForPayment(
        { fundSource: null, fundLabel: null },
        null,
        { fundSource: "JOINT", fundLabel: null },
      ).fund,
    ).toBe("JOINT");
  });

  it("returns UNASSIGNED when nothing is set anywhere", () => {
    expect(
      effectiveFundForPayment(
        { fundSource: null, fundLabel: null },
        null,
        null,
      ).fund,
    ).toBe("UNASSIGNED");
  });
});

describe("groupTotalsByFund", () => {
  it("buckets amounts by their fund key", () => {
    const rows = [
      { fund: "JOINT" as const, amount: 100 },
      { fund: "JOINT" as const, amount: 200 },
      { fund: "OTHER" as const, amount: 50 },
      { fund: "UNASSIGNED" as const, amount: 25 },
    ];
    const totals = groupTotalsByFund(
      rows,
      (r) => r.fund,
      (r) => r.amount,
    );
    expect(totals.JOINT).toBe(300);
    expect(totals.OTHER).toBe(50);
    expect(totals.UNASSIGNED).toBe(25);
    expect(totals.PERSONAL_BRIDE).toBe(0);
    expect(totals.PERSONAL_GROOM).toBe(0);
  });

  it("returns all-zero record for an empty list", () => {
    const totals = groupTotalsByFund<{ amount: number }>(
      [],
      () => "JOINT",
      (r) => r.amount,
    );
    expect(totals.JOINT).toBe(0);
    expect(totals.OTHER).toBe(0);
  });
});

describe("rowMatchesFundFilter", () => {
  it("matches everything under ALL", () => {
    expect(rowMatchesFundFilter("JOINT", "ALL")).toBe(true);
    expect(rowMatchesFundFilter("UNASSIGNED", "ALL")).toBe(true);
  });

  it("matches only the picked fund otherwise", () => {
    expect(rowMatchesFundFilter("JOINT", "JOINT")).toBe(true);
    expect(rowMatchesFundFilter("OTHER", "JOINT")).toBe(false);
    expect(rowMatchesFundFilter("UNASSIGNED", "UNASSIGNED")).toBe(true);
  });
});
