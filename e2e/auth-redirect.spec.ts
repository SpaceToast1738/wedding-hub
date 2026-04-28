import { expect, test } from "@playwright/test";

// Anonymous flow — no session, middleware should bounce to /signin.
//
// These specs cover the audit's permissions matrix at the routing
// layer: any unauthenticated request to an `(app)` route must land
// on /signin with a callbackUrl preserving the original target.
// Logic lives in src/middleware.ts; specs are the regression net.
//
// Authenticated paths (couple-only redirects from /budget, F1
// canView gates, etc.) are tested at the unit + integration level
// in tests/unit/permissions.test.ts and tests/integration/permissions.test.ts.

test.describe("anonymous redirects", () => {
  test("/ redirects unauthenticated users to /signin", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("/guests preserves the callbackUrl on bounce", async ({ page }) => {
    const response = await page.goto("/guests");
    // Final URL after redirect chain
    expect(page.url()).toContain("/signin");
    expect(page.url()).toContain("callbackUrl");
    expect(page.url()).toContain("guests");
    // The 200 is from the rendered /signin page, not the original /guests
    expect(response?.status()).toBeLessThan(400);
  });

  test("/budget bounces to /signin (couple-only route, but auth comes first)", async ({ page }) => {
    await page.goto("/budget");
    // Anonymous visitors hit the auth gate before the couple-only gate;
    // they land on /signin, not /. A signed-in non-couple user would land
    // on / — that's tested separately at the integration level.
    await expect(page).toHaveURL(/\/signin/);
  });

  test("/api/health is publicly reachable (no auth required)", async ({ page }) => {
    const response = await page.goto("/api/health");
    expect(response?.status()).toBe(200);
    const body = await page.textContent("body");
    expect(body).toContain("ok");
  });

  test("/signin renders without authentication", async ({ page }) => {
    await page.goto("/signin");
    await expect(page).toHaveTitle(/Wedding Hub|Sign in/i);
    // Email input should be present
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });
});
