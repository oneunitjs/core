import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "app/create-oneunit/test/**/*.test.ts"],
    testTimeout: 15000,
  },
});
