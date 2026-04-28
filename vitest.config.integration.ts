import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate config for integration tests so:
// - `npm test` stays fast (unit only)
// - integration tests can require DATABASE_URL without polluting unit runs
// - CI can run them as a separate job with a Postgres service container
//
// Tests live in tests/integration/**. Each test should self-skip if
// DATABASE_URL isn't set (or isn't pointing at a *test* DB) so local
// `npm run test:integration` doesn't accidentally clobber a dev DB.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Integration tests touch a real DB; serialise to avoid one test
    // wiping data another test is reading. Slower but safer.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // Generous timeout — first migration apply on a fresh DB can be slow.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
