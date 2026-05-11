import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/rls.integration.test.ts"],
    testTimeout: 60_000,
  },
});
