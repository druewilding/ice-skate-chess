import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.test.js",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3847",
    // Run headless by default; use --headed to see the browser
    headless: true,
  },
  // Writes firebase config from .env (same as start.sh) then serves on a dedicated test port
  webServer: {
    command: "bash start-test.sh",
    port: 3847,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
