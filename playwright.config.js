import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  fullyParallel: false, // your app has shared server-side state (sessions, DB); keep it sequential to start
  reporter: "list",

  use: {
    baseURL: "http://localhost:3000", // your app.js listens on port 3000
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Uncomment this once you have a dedicated test/staging DB — Playwright will
  // start your server automatically before running tests and shut it down after.
  // webServer: {
  //   command: "npm run start",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: true,
  //   env: { NODE_ENV: "test" },
  // },
});