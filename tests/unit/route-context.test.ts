import { describe, expect, it } from "vitest";
import { describeRoute } from "@/lib/ai/route-context";

describe("describeRoute", () => {
  it("maps the root to the Today dashboard", () => {
    expect(describeRoute("/")).toBe("the Today dashboard");
  });

  it("maps a top-level nav route", () => {
    expect(describeRoute("/tasks")).toBe("the Tasks page");
    expect(describeRoute("/guests")).toBe("the Guests page");
    expect(describeRoute("/budget")).toBe("the Budget page");
  });

  it("maps a detail page under a nav route", () => {
    expect(describeRoute("/guests/abc123")).toBe("a detail page under Guests");
    expect(describeRoute("/book/venue-ceremony")).toBe(
      "a detail page under Wedding Book",
    );
  });

  it("tolerates trailing slashes", () => {
    expect(describeRoute("/tasks/")).toBe("the Tasks page");
    expect(describeRoute("///")).toBe("the Today dashboard");
  });

  it("labels non-nav extras", () => {
    expect(describeRoute("/ai")).toBe("the AI planner page");
    expect(describeRoute("/settings")).toBe("the Settings page");
  });

  it("returns null for unknown routes", () => {
    expect(describeRoute("/nope")).toBeNull();
    expect(describeRoute("/api/ai/chat")).toBeNull();
  });
});
