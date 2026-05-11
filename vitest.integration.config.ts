import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Allow .env to override empty placeholders some shells/IDEs inject for sensitive keys.
config({ override: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/rls.integration.test.ts"],
    testTimeout: 60_000,
  },
});
