import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
});
