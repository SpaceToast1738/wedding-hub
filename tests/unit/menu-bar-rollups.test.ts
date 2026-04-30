import { describe, expect, it } from "vitest";
import {
  barRollups,
  menuRollups,
  type BarCardShape,
  type GuestMealRow,
  type MenuCardShape,
} from "@/lib/book-cards";

// v1.32.0: MENU + BAR pure helpers.
//
// menuRollups: live count of guest selections per option, scoped per
// course label (Starter ↔ mealStarter, Main ↔ mealMain, Dessert ↔
// mealDessert). Matches case-insensitively. Allergen aggregation
// counts dietary tags only for guests who selected at least one
// option (not unconditionally).
//
// barRollups: per-category totals, bottles-per-adult sanity check
// only when both the unit is a "bottle" variant and confirmedAdults
// is supplied.

describe("menuRollups", () => {
  const baseCard: MenuCardShape = {
    pricePerHeadPence: 8500,
    confirmedHeadcount: 100,
    courses: [
      {
        id: "c-starter",
        courseLabel: "Starter",
        options: [
          { id: "o-soup", label: "Tomato soup", dietary: ["V"], isVegetarianMain: false, isKidsMeal: false },
          { id: "o-prawns", label: "Prawn cocktail", dietary: [], isVegetarianMain: false, isKidsMeal: false },
        ],
      },
      {
        id: "c-main",
        courseLabel: "Main",
        options: [
          { id: "o-beef", label: "Roast beef", dietary: [], isVegetarianMain: false, isKidsMeal: false },
          { id: "o-mushroom", label: "Mushroom wellington", dietary: ["V"], isVegetarianMain: true, isKidsMeal: false },
        ],
      },
    ],
  };

  it("computes price as headcount × pricePerHead", () => {
    const r = menuRollups(baseCard, []);
    expect(r.pricePence).toBe(8500 * 100);
  });

  it("falls back to attending guest count if confirmedHeadcount is null", () => {
    const r = menuRollups(
      { ...baseCard, confirmedHeadcount: null },
      [
        { attending: true },
        { attending: true },
        { attending: false }, // declined
      ],
    );
    expect(r.totalConfirmed).toBe(2);
  });

  it("counts guest selections per option (case-insensitive label match)", () => {
    const guests: GuestMealRow[] = [
      { mealStarter: "Tomato Soup", mealMain: "Roast beef" },
      { mealStarter: "tomato soup", mealMain: "Mushroom wellington" },
      { mealStarter: "Prawn cocktail", mealMain: "Roast beef" },
    ];
    const r = menuRollups(baseCard, guests);
    expect(r.perCourseCounts["c-starter"]!["o-soup"]).toBe(2);
    expect(r.perCourseCounts["c-starter"]!["o-prawns"]).toBe(1);
    expect(r.perCourseCounts["c-main"]!["o-beef"]).toBe(2);
    expect(r.perCourseCounts["c-main"]!["o-mushroom"]).toBe(1);
  });

  it("ignores declined guests in selection counts", () => {
    const guests: GuestMealRow[] = [
      { attending: true, mealStarter: "Tomato soup" },
      { attending: false, mealStarter: "Tomato soup" }, // declined — shouldn't count
    ];
    const r = menuRollups(baseCard, guests);
    expect(r.perCourseCounts["c-starter"]!["o-soup"]).toBe(1);
  });

  it("aggregates dietary tags only against guests who selected ≥1 option", () => {
    const guests: GuestMealRow[] = [
      { mealStarter: "Tomato soup", dietary: ["GF", "DF"] },
      { mealStarter: "Tomato soup", dietary: ["GF"] },
      // No matching selection — dietary tags ignored
      { mealStarter: "Off-menu request", dietary: ["Nut allergy"] },
    ];
    const r = menuRollups(baseCard, guests);
    expect(r.allergenAggregate.GF).toBe(2);
    expect(r.allergenAggregate.DF).toBe(1);
    expect(r.allergenAggregate["Nut allergy"]).toBeUndefined();
  });

  it("returns 0 for all options when no guests select anything", () => {
    const r = menuRollups(baseCard, [{ attending: true }]);
    expect(r.perCourseCounts["c-starter"]!["o-soup"]).toBe(0);
    expect(r.perCourseCounts["c-starter"]!["o-prawns"]).toBe(0);
  });

  it("skips counting for course labels with no Guest field (e.g. Late-night)", () => {
    const card: MenuCardShape = {
      pricePerHeadPence: null,
      confirmedHeadcount: null,
      courses: [
        {
          id: "c-late",
          courseLabel: "Late-night",
          options: [{ id: "o-pizza", label: "Pizza slice", dietary: [], isVegetarianMain: false, isKidsMeal: false }],
        },
      ],
    };
    const r = menuRollups(card, [{ attending: true, mealMain: "Pizza slice" }]);
    expect(r.perCourseCounts["c-late"]!["o-pizza"]).toBe(0);
  });

  it("price is 0 when pricePerHeadPence is null", () => {
    const r = menuRollups({ ...baseCard, pricePerHeadPence: null }, []);
    expect(r.pricePence).toBe(0);
  });
});

describe("barRollups", () => {
  const baseCard: BarCardShape = {
    items: [
      { category: "Wine", quantityPlanned: 30, unit: "bottles", costPence: 25000 },
      { category: "Wine", quantityPlanned: 15, unit: "bottles", costPence: 15000 },
      { category: "Beer", quantityPlanned: 60, unit: "bottles", costPence: 12000 },
      { category: "Soft", quantityPlanned: 24, unit: "L", costPence: 4800 },
      { category: "Reception drink", quantityPlanned: 30, unit: "bottles", costPence: 30000 }, // toast bubbles
    ],
  };

  it("totals cost across all items", () => {
    const r = barRollups(baseCard, 100);
    expect(r.totalCostPence).toBe(25000 + 15000 + 12000 + 4800 + 30000);
  });

  it("groups per category", () => {
    const r = barRollups(baseCard, 100);
    expect(r.perCategory.Wine!.itemCount).toBe(2);
    expect(r.perCategory.Wine!.totalCostPence).toBe(40000);
    expect(r.perCategory.Wine!.bottlesPlanned).toBe(45);
    expect(r.perCategory.Beer!.itemCount).toBe(1);
    expect(r.perCategory.Soft!.bottlesPlanned).toBe(0); // L ≠ bottle
  });

  it("flags low when below 0.5 bottles/adult", () => {
    // 30+30 = 60 bottles, 200 adults → 0.3
    const r = barRollups(
      {
        items: [
          { category: "Wine", quantityPlanned: 30, unit: "bottles", costPence: 1 },
          { category: "Beer", quantityPlanned: 30, unit: "bottles", costPence: 1 },
        ],
      },
      200,
    );
    expect(r.perHeadFlag).toBe("low");
    expect(r.bottlesPerAdult).toBe(0.3);
  });

  it("flags high when above 1.5 bottles/adult", () => {
    const r = barRollups(
      {
        items: [{ category: "Wine", quantityPlanned: 200, unit: "bottles", costPence: 1 }],
      },
      100,
    );
    expect(r.perHeadFlag).toBe("high");
  });

  it("ok at 1.0 bottles/adult", () => {
    const r = barRollups(
      {
        items: [{ category: "Wine", quantityPlanned: 100, unit: "bottles", costPence: 1 }],
      },
      100,
    );
    expect(r.perHeadFlag).toBe("ok");
  });

  it("ok at exactly the boundaries (0.5 and 1.5)", () => {
    expect(
      barRollups(
        { items: [{ category: "Wine", quantityPlanned: 50, unit: "bottles", costPence: 1 }] },
        100,
      ).perHeadFlag,
    ).toBe("ok");
    expect(
      barRollups(
        { items: [{ category: "Wine", quantityPlanned: 150, unit: "bottles", costPence: 1 }] },
        100,
      ).perHeadFlag,
    ).toBe("ok");
  });

  it("returns 'unknown' when confirmedAdults is null", () => {
    const r = barRollups(baseCard, null);
    expect(r.perHeadFlag).toBe("unknown");
    expect(r.bottlesPerAdult).toBeNull();
  });

  it("returns 'unknown' when no items count as bottles", () => {
    const r = barRollups(
      {
        items: [{ category: "Soft", quantityPlanned: 100, unit: "L", costPence: 1 }],
      },
      100,
    );
    expect(r.perHeadFlag).toBe("unknown");
  });

  // v1.32.2: per-head pricing.

  it("computes per-head item total as price × adults × drinksPerHead", () => {
    // £2.50/head × 100 adults × 1 drink = £250
    const r = barRollups(
      {
        items: [
          {
            category: "Reception drink",
            timing: "Toast",
            quantityPlanned: 1,
            pricePerHeadPence: 250,
          },
        ],
      },
      100,
    );
    expect(r.totalCostPence).toBe(25000);
  });

  it("respects drinksPerHead > 1 on per-head items", () => {
    // £4.00/head × 80 adults × 2 drinks = £640
    const r = barRollups(
      {
        items: [
          {
            category: "Reception drink",
            quantityPlanned: 2,
            pricePerHeadPence: 400,
          },
        ],
      },
      80,
    );
    expect(r.totalCostPence).toBe(64000);
  });

  it("defaults drinksPerHead to 1 when quantityPlanned is null on per-head items", () => {
    const r = barRollups(
      {
        items: [
          {
            category: "Toast",
            quantityPlanned: null,
            pricePerHeadPence: 250,
          },
        ],
      },
      100,
    );
    expect(r.totalCostPence).toBe(25000);
  });

  it("per-head item ignores costPence when pricePerHeadPence is set", () => {
    const r = barRollups(
      {
        items: [
          {
            category: "Reception drink",
            quantityPlanned: 1,
            pricePerHeadPence: 250,
            costPence: 999999, // intentionally wild — should be ignored
          },
        ],
      },
      100,
    );
    expect(r.totalCostPence).toBe(25000);
  });

  it("contributes 0 to total when confirmedAdults is null on per-head items", () => {
    const r = barRollups(
      {
        items: [{ category: "Toast", quantityPlanned: 1, pricePerHeadPence: 250 }],
      },
      null,
    );
    expect(r.totalCostPence).toBe(0);
  });

  it("per-head items do NOT count toward the bottles-per-adult sanity check", () => {
    // 60 bottles + a per-head toast at £2.50 — toast doesn't move the bottle ratio.
    const r = barRollups(
      {
        items: [
          { category: "Wine", quantityPlanned: 60, unit: "bottles", costPence: 30000 },
          { category: "Toast", quantityPlanned: 1, unit: "drinks", pricePerHeadPence: 250 },
        ],
      },
      100,
    );
    expect(r.bottlesPerAdult).toBe(0.6);
    expect(r.perHeadFlag).toBe("ok");
  });

  it("mixed bottles + per-head items both contribute to total cost", () => {
    const r = barRollups(
      {
        items: [
          { category: "Wine", quantityPlanned: 60, unit: "bottles", costPence: 30000 },
          { category: "Toast", quantityPlanned: 1, pricePerHeadPence: 250 },
        ],
      },
      100,
    );
    // 30000 (wine) + 25000 (toast at £2.50 × 100 × 1) = 55000
    expect(r.totalCostPence).toBe(55000);
  });
});
