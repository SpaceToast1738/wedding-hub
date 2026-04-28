import { describe, expect, it } from "vitest";
import { resolveDarkMode } from "@/lib/dark-mode";

describe("resolveDarkMode — B11 precedence", () => {
  it("DB pref true → dark (overrides any localStorage)", () => {
    expect(resolveDarkMode(true, "light")).toBe("dark");
    expect(resolveDarkMode(true, null)).toBe("dark");
    expect(resolveDarkMode(true, "dark")).toBe("dark");
  });

  it("DB pref false → light (overrides any localStorage)", () => {
    expect(resolveDarkMode(false, "dark")).toBe("light");
    expect(resolveDarkMode(false, null)).toBe("light");
    expect(resolveDarkMode(false, "light")).toBe("light");
  });

  it("DB pref null + localStorage 'dark' → dark", () => {
    expect(resolveDarkMode(null, "dark")).toBe("dark");
  });

  it("DB pref null + localStorage 'light' → light", () => {
    expect(resolveDarkMode(null, "light")).toBe("light");
  });

  it("both null → light (matches pre-B11 default)", () => {
    expect(resolveDarkMode(null, null)).toBe("light");
  });

  it("undefined treated as null on either side", () => {
    expect(resolveDarkMode(undefined, undefined)).toBe("light");
    expect(resolveDarkMode(undefined, "dark")).toBe("dark");
    expect(resolveDarkMode(true, undefined)).toBe("dark");
  });

  it("unrecognised localStorage value treated as missing (defaults to light)", () => {
    expect(resolveDarkMode(null, "auto")).toBe("light");
    expect(resolveDarkMode(null, "")).toBe("light");
  });
});
