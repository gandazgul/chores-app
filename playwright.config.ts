import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const e2ePort = process.env.E2E_PORT ?? "8080";
// Keep browser tests away from development data and disable real deliveries.
process.env.DB_ENV = "test";
process.env.DB_PATH ??= `${process.cwd()}/chores.e2e.db`;
process.env.PUBLIC_ORIGIN = `http://127.0.0.1:${e2ePort}`;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      `deno task db:setup && ENABLE_AUTH=false ENABLE_NOTIFICATIONS=false deno run -A --env npm:astro dev --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
