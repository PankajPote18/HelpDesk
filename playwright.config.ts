import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/test-results",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never", outputFolder: "./e2e/playwright-report" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun run --hot src/index.ts",
      cwd: path.resolve(__dirname, "server"),
      port: 3000,
      reuseExistingServer: true,
      env: { NODE_ENV: "test" },
    },
    {
      command: "bun run dev",
      cwd: path.resolve(__dirname, "client"),
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
