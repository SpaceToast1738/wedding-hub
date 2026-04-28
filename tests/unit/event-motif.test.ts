import { describe, expect, it } from "vitest";
import { classifyEventMotif } from "@/components/ui/EventMotifIcon";

describe("classifyEventMotif — C11 heuristic", () => {
  it("matches ceremony/vow/ring titles to ring", () => {
    expect(classifyEventMotif("Ceremony")).toBe("ring");
    expect(classifyEventMotif("Vow renewal")).toBe("ring");
    expect(classifyEventMotif("Ring exchange")).toBe("ring");
  });

  it("matches food titles to plate", () => {
    expect(classifyEventMotif("Wedding Breakfast")).toBe("plate");
    expect(classifyEventMotif("Evening Buffet")).toBe("plate");
  });

  it("matches drinks reception / first dance / evening to candle", () => {
    expect(classifyEventMotif("Drinks Reception")).toBe("candle");
    expect(classifyEventMotif("First Dance")).toBe("candle");
    expect(classifyEventMotif("Speeches")).toBe("candle");
  });

  it("matches photography to camera", () => {
    expect(classifyEventMotif("Couple Portraits")).toBe("camera");
    expect(classifyEventMotif("Group photos")).toBe("camera");
  });

  it("matches arrival/check-in to suitcase", () => {
    expect(classifyEventMotif("Arrival")).toBe("suitcase");
    expect(classifyEventMotif("Bridal suite check-in")).toBe("suitcase");
  });

  it("matches flowers/decor to bouquet", () => {
    expect(classifyEventMotif("Flower delivery")).toBe("bouquet");
    expect(classifyEventMotif("Bouquet toss")).toBe("bouquet");
  });

  it("returns null for unrecognised titles", () => {
    expect(classifyEventMotif("Random thing")).toBeNull();
    expect(classifyEventMotif("")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(classifyEventMotif("CEREMONY")).toBe("ring");
    expect(classifyEventMotif("ceremony")).toBe("ring");
  });
});
