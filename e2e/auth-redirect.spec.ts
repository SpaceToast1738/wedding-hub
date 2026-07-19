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
    // What we're asserting: middleware allowlists /api/health (it must
    // not bounce to /signin). Status code can be 200 (DB up — happy path)
    // or 503 (DB down — endpoint still returns JSON), both of which mean
    // the route handler ran. A redirect to /signin would be the audit
    // failure mode this spec exists to catch.
    const response = await page.goto("/api/health");
    expect(page.url()).toContain("/api/health");
    expect(page.url()).not.toContain("/signin");
    expect([200, 503]).toContain(response?.status() ?? 0);
  });

  test("/api/mcp answers unauthenticated POSTs with 401 JSON (no auth redirect)", async ({ request }) => {
    // What we're asserting: middleware allowlists /api/mcp (sibling of
    // the /api/health carve-out) so MCP clients get a clean JSON 401 —
    // never a 307 HTML redirect to /signin, which SDK clients would
    // surface as an inscrutable transport failure. Uses the request
    // fixture because GET /api/mcp is 405 by design (stateless server,
    // no SSE channel) — page.goto would test the wrong method.
    const response = await request.post("/api/mcp", {
      data: { jsonrpc: "2.0", id: 1, method: "ping" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    // WWW-Authenticate tells clients this is bearer auth — without it
    // some SDKs go probing for OAuth discovery metadata.
    expect(response.headers()["www-authenticate"]).toBe("Bearer");
    expect(response.url()).not.toContain("/signin");
  });

  test("/signin renders without authentication", async ({ page }) => {
    await page.goto("/signin");
    await expect(page).toHaveTitle(/Wedding Hub|Sign in/i);
    // Email input should be present
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });
});
