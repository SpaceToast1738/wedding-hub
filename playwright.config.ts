import { defineConfig, devices } from "@playwright/test";

// Playwright config for the v1.10.0 e2e scaffold.
//
// Specs live in `e2e/`. Each one starts the dev server (in CI; locally
// we reuse a running one if present), points a browser at it, and
// asserts user-visible behaviour.
//
// Auth model for v1.10.0: anonymous-only. Specs cover middleware
// redirect paths that don't need a logged-in session — they're the
// flows the audit's permissions matrix relies on. Authenticated specs
// (CSV import, supplier comm, day-of mode) are deferred until we have
// a clean way to seed a session token without going through the
// magic-link round-trip.
//
// Why Chromium-only: GHA runner cost / wall-clock + the audit brief
// explicitly scoped cross-browser as out of scope.

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Fail the build if a test is accidentally left in `.only` mode.
  forbidOnly: !!process.env.CI,
  // Retry once in CI to absorb DB-warmup flakes; never locally.
  retries: process.env.CI ? 1 : 0,
  // Single worker in CI keeps DB writes deterministic; parallel locally.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // The middleware checks auth + redirects, so a fast follow-redirect
    // pattern matters. 5s default is plenty for an unauth bounce.
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Boot `next start` (against the prebuilt app) for tests. Reuse a
  // server already running locally so the dev iteration loop is fast.
  // In CI: spin up fresh, tear down at end. Build step happens in the
  // GHA workflow before this config runs.
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
