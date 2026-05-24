import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/cli.ts"],
      thresholds: {
        lines: 95,
        branches: 90,
      },
    },
  },
});
