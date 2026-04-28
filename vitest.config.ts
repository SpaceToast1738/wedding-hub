import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal Vitest config for R1.
// - Node environment (no DOM yet — R1 covers pure functions and helpers).
// - Path alias `@/*` matches tsconfig so test files can import app code
//   the same way it's imported in src/.
// - Include only `tests/**` so we don't accidentally pull in fixtures or
//   stray files from elsewhere in the tree.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
