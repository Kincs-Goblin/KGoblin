import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
/** Woo-kiesést szimuláló második szerver (`e2e/outage.spec.ts`). */
export const outagePort = port + 1;
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
  webServer: [
    {
      command: `pnpm exec next start --port ${port}`,
      port,
      // Alapból determinisztikus Store API-fixture-ök (ADR-0005), de KG_STORE_FIXTURES=0 értékkel élő Docker-Woo ellen is futtatható.
      env: {
        KG_STORE_FIXTURES: process.env.KG_STORE_FIXTURES || "1",
        NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || "local",
        ...(process.env.WOO_GAMER_URL ? { WOO_GAMER_URL: process.env.WOO_GAMER_URL } : {}),
      },
      // Mindig friss szerver: egy régi build kiszolgálása hamis zöldet vagy hibát adna.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Ugyanaz a build Woo-kiesésben: fixture és Woo-cím nélkül minden Store API-hívás WOO.UNAVAILABLE.
      command: `pnpm exec next start --port ${outagePort}`,
      port: outagePort,
      env: { KG_STORE_FIXTURES: "0", NEXT_PUBLIC_APP_ENV: "local", WOO_GAMER_URL: "" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
