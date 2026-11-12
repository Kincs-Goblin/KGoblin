import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
/** A brandet a host választja: a `*.localhost` aldomain a Chromiumban külön DNS nélkül is működik. */
const baseURL = `http://gamer.localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  // Windowson a párhuzamos headless Chromium instabil volt (navigációs timeout); a smoke-csomag kicsi.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec next start --port ${port}`,
    port,
    // Mindig friss szerver: egy régi build kiszolgálása hamis zöldet vagy hibát adna.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
