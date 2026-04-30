import { describe, expect, it } from "vitest";
import { findMealChoiceLinks, findStaysForGuest } from "@/lib/guest-cross-refs";

describe("findStaysForGuest", () => {
  const stays = [
    {
      cardId: "s1",
      subsectionId: "ss1",
      subsectionSlug: "bridal-suite",
      subsectionTitle: "Bridal Suite",
      sectionSlug: "accommodation",
      propertyName: "Alveston Manor",
      checkInDate: new Date("2026-09-25T15:00:00Z"),
      checkOutDate: new Date("2026-09-27T11:00:00Z"),
      guestIds: ["g-bryony", "g-jamie"],
    },
    {
      cardId: "s2",
      subsectionId: "ss2",
      subsectionSlug: "bridesmaids",
      subsectionTitle: "Bridesmaids — night before",
      sectionSlug: "accommodation",
      propertyName: "Alveston Manor — bridesmaid block",
      checkInDate: new Date("2026-09-24T15:00:00Z"),
      checkOutDate: null,
      guestIds: ["g-aimee"],
    },
    {
      cardId: "s3",
      subsectionId: "ss3",
      subsectionSlug: "no-guests",
      subsectionTitle: "Empty",
      sectionSlug: "accommodation",
      propertyName: "Empty",
      checkInDate: null,
      checkOutDate: null,
      guestIds: [],
    },
  ];

  it("returns empty when no stay lists this guest", () => {
    expect(findStaysForGuest("g-nobody", stays)).toEqual([]);
  });

  it("returns stays where guestIds includes the guest", () => {
    const r = findStaysForGuest("g-bryony", stays);
    expect(r).toHaveLength(1);
    expect(r[0]!.subsectionSlug).toBe("bridal-suite");
  });

  it("strips guestIds from the result shape", () => {
    const r = findStaysForGuest("g-aimee", stays);
    // @ts-expect-error guestIds shouldn't appear
    expect(r[0]!.guestIds).toBeUndefined();
  });

  it("sorts by check-in date ascending (with nulls last)", () => {
    const r = findStaysForGuest("g-aimee", [
      ...stays,
      {
        cardId: "s4",
        subsectionId: "ss4",
        subsectionSlug: "early",
        subsectionTitle: "early",
        sectionSlug: "accommodation",
        propertyName: "Z",
        checkInDate: new Date("2026-09-23T15:00:00Z"),
        checkOutDate: null,
        guestIds: ["g-aimee"],
      },
    ]);
    expect(r.map((s) => s.subsectionSlug)).toEqual(["early", "bridesmaids"]);
  });
});

describe("findMealChoiceLinks", () => {
  const options = [
    {
      optionId: "o1",
      optionLabel: "Tomato soup",
      courseLabel: "Starter",
      cardId: "menu-breakfast",
      subsectionSlug: "wedding-breakfast",
      subsectionTitle: "Wedding breakfast",
      sectionSlug: "food-drink",
    },
    {
      optionId: "o2",
      optionLabel: "Prawn cocktail",
      courseLabel: "Starter",
      cardId: "menu-breakfast",
      subsectionSlug: "wedding-breakfast",
      subsectionTitle: "Wedding breakfast",
      sectionSlug: "food-drink",
    },
    {
      optionId: "o3",
      optionLabel: "Beef wellington",
      courseLabel: "Main",
      cardId: "menu-breakfast",
      subsectionSlug: "wedding-breakfast",
      subsectionTitle: "Wedding breakfast",
      sectionSlug: "food-drink",
    },
  ];

  it("returns empty when guest has no choices", () => {
    expect(findMealChoiceLinks({}, options)).toEqual([]);
  });

  it("matches case-insensitively + trims whitespace", () => {
    const r = findMealChoiceLinks(
      { mealStarter: "  TOMATO SOUP  ", mealMain: "Beef Wellington" },
      options,
    );
    expect(r).toHaveLength(2);
    expect(r[0]!.matched?.optionId).toBe("o1");
    expect(r[1]!.matched?.optionId).toBe("o3");
  });

  it("returns null match when the guest's free-text doesn't match any option", () => {
    const r = findMealChoiceLinks({ mealStarter: "Mystery soup" }, options);
    expect(r).toHaveLength(1);
    expect(r[0]!.matched).toBeNull();
    expect(r[0]!.guestChoice).toBe("Mystery soup");
  });

  it("preserves the guestChoice text even when matched", () => {
    const r = findMealChoiceLinks({ mealStarter: "Tomato soup" }, options);
    expect(r[0]!.guestChoice).toBe("Tomato soup");
  });

  it("prefers a same-course match when label is ambiguous across courses", () => {
    const optsWithDuplicate = [
      ...options,
      {
        optionId: "o4",
        optionLabel: "Tomato soup",
        courseLabel: "Main",
        cardId: "menu-breakfast",
        subsectionSlug: "wedding-breakfast",
        subsectionTitle: "Wedding breakfast",
        sectionSlug: "food-drink",
      },
    ];
    const r = findMealChoiceLinks(
      { mealStarter: "Tomato soup", mealMain: "Tomato soup" },
      optsWithDuplicate,
    );
    expect(r[0]!.matched?.courseLabel).toBe("Starter");
    expect(r[1]!.matched?.courseLabel).toBe("Main");
  });

  it("emits one entry per non-empty course choice", () => {
    const r = findMealChoiceLinks(
      { mealStarter: "Tomato soup", mealMain: "Beef wellington", mealDessert: null },
      options,
    );
    expect(r.map((h) => h.course)).toEqual(["starter", "main"]);
  });

  it("ignores empty string choices", () => {
    const r = findMealChoiceLinks({ mealStarter: "", mealMain: "   " }, options);
    expect(r).toEqual([]);
  });
});
