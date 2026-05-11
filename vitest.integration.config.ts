import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load .env then optional .env.test.local (gitignored) so Expo-only .env need not contain service_role.
config({ path: ".env", override: true });
config({ path: ".env.test.local", override: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/rls.integration.test.ts"],
    testTimeout: 60_000,
  },
});
