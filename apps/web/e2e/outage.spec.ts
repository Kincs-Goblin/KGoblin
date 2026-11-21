import { expect, test } from "@playwright/test";

import { outagePort } from "../playwright.config";

/** A második webServer ugyanazt a buildet szolgálja ki Woo nélkül (playwright.config.ts). */
const outageURL = `http://gamer.localhost:${outagePort}`;

const robotsMeta = 'head meta[name="robots"][content="noindex"]';

test.describe("Woo-kiesés", () => {
  test("a katalógus és a szűrt katalógus hibaállapota noindex a <head>-ben", async ({ page }) => {
    for (const path of ["/termekek", "/termekek?min_price=1234"]) {
      await page.goto(`${outageURL}${path}`);
      await expect(page.getByRole("main").getByRole("alert")).toContainText("WOO.UNAVAILABLE");
      await expect(page.locator(robotsMeta)).toHaveCount(1);
    }
  });

  test("a termékoldal hibaállapota noindex a <head>-ben", async ({ page }) => {
    await page.goto(`${outageURL}/termek/barmi`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("WOO.UNAVAILABLE");
    await expect(page.locator(robotsMeta)).toHaveCount(1);
  });

  test("a főoldal a buildkor prerenderelt jó változatot adja, indexelhetően", async ({ page }) => {
    await page.goto(`${outageURL}/`);
    await expect(page.getByRole("heading", { name: "Friss zsákmány" })).toBeVisible();
    await expect(page.locator(robotsMeta)).toHaveCount(0);
  });
});
