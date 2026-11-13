import { expect, test } from "@playwright/test";

/** `SCREENSHOTS=1` esetén a review-képek a git által ignorált `output/ui-review/KG-5/` alá kerülnek. */
const shotDir = "../../output/ui-review/KG-5";
const takeShots = process.env.SCREENSHOTS === "1";

test("a főoldal a brand témájával és fejlécével jelenik meg", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/KincsGoblin/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lépj be a Goblin kocsmájába");
  await expect(page.getByRole("banner").getByRole("link", { name: /KincsGoblin/ })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("ÁSZF");

  // A brand tokenjei a :root-on vannak (nem a semleges tartalék).
  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
  );
  expect(background).toBe("oklch(0.19 0.025 50)");
  // A stíluslap is betöltött (nem csak az inline tokenek): a body háttere nem átlátszó.
  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBackground).not.toBe("rgba(0, 0, 0, 0)");

  if (takeShots) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shotDir}/home-${testInfo.project.name}.png`, fullPage: true });
  }
});

test("billentyűzettel elérhető az ugrólink", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Ugrás a tartalomra" })).toBeFocused();
});

test("ismeretlen útvonalon a brand saját 404-oldala jön", async ({ page }, testInfo) => {
  const response = await page.goto("/nincs-ilyen-oldal");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Ez az ösvény zsákutca" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();

  if (takeShots) {
    await page.screenshot({ path: `${shotDir}/404-${testInfo.project.name}.png`, fullPage: true });
  }
});

test("ismeretlen hostra nincs alapértelmezett brand", async ({ request }) => {
  const port = new URL(test.info().project.use.baseURL!).port;
  const response = await request.get(`http://localhost:${port}/`);
  expect(response.status()).toBe(404);
  expect(await response.text()).toBe("BRAND.UNKNOWN_HOST");
});

test.describe("csökkentett mozgás", () => {
  test.use({ reducedMotion: "reduce" });

  test("csökkentett mozgásnál a hero teljesen látható és nem marad eltolva", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const hero = page.getByRole("heading", { level: 1 }).locator("..");
    await expect(hero).toHaveCSS("opacity", "1");
    // A végállapotot nézi (opacity 1, nincs maradék eltolás); a mozgás hiányát a MotionConfig
    // reducedMotion="user" adja, ezt a felvételen/screenshoton ellenőrizzük, nem itt.
    await expect(hero).toHaveCSS("transform", "none");
    if (takeShots) {
      await page.screenshot({
        path: `${shotDir}/home-reduced-motion-${testInfo.project.name}.png`,
      });
    }
  });
});
