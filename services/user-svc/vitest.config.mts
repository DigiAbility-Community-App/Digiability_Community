import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Integration tests share one local Postgres/Redis — run files serially.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
