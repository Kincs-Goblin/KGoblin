import { expect, test } from "@playwright/test";

/**
 * A fő vásárlói út a mentett Store API-fixture-ökön (KG_STORE_FIXTURES=1): főoldal → kategória →
 * termék → kosárba → kosár drawer. `SCREENSHOTS=1` esetén review-képek az output/ui-review/KG-5/ alá.
 */
const shotDir = "../../output/ui-review/KG-5";
const takeShots = process.env.SCREENSHOTS === "1";

test("főoldal → kategória → termék → kosárba → drawer", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Friss zsákmány" })).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();
  if (takeShots) {
    await page.screenshot({
      path: `${shotDir}/shop-home-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }

  await page
    .getByRole("navigation", { name: "Kategóriák" })
    .getByRole("link", { name: "Gamer Perifériák" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Gamer Perifériák" })).toBeVisible();
  await expect(page.getByText("3 termék", { exact: true })).toBeVisible();
  if (takeShots) {
    await page.screenshot({
      path: `${shotDir}/shop-category-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }

  await page
    .getByRole("link", { name: /ApexStrike Pro 75%/ })
    .first()
    .click();
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toContainText("ApexStrike Pro 75%");
  // Akciós termék: Woo-ból jövő akciós ár, áthúzott eredeti ár és Omnibus 30 napos legalacsonyabb ár.
  await expect(page.getByText(/Az elmúlt 30 nap legalacsonyabb ára:/)).toBeVisible();
  if (takeShots) {
    await page.screenshot({
      path: `${shotDir}/shop-product-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }

  await page
    .getByRole("main")
    .getByRole("button", { name: /kosárba tétele/ })
    .click();
  const cartButton = page.getByRole("banner").getByRole("button", { name: /^Kosár/ });
  await expect(cartButton).toHaveAccessibleName("Kosár, 1 termék");

  await cartButton.click();
  const drawer = page.getByRole("dialog", { name: "Zsákmányod" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: /ApexStrike Pro 75%/ })).toBeVisible();
  await expect(drawer.getByText(/^Az árak tájékoztató jellegűek\. A végösszeget/)).toBeVisible();

  await drawer.getByRole("button", { name: /eggyel több/ }).click();
  // Nyitott modális drawer mellett a fejléc rejtett a kisegítő technológiák elől; a drawerben nézzük.
  await expect(drawer.getByRole("group", { name: "Darab" })).toContainText("2");
  if (takeShots) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shotDir}/shop-cart-${testInfo.project.name}.png` });
  }

  await drawer.getByRole("button", { name: /eltávolítása/ }).click();
  await expect(drawer.getByText(/Még üres a zsák/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(cartButton).toHaveAccessibleName("Kosár, üres");
});

test("a kosár újratöltés után is megmarad", async ({ page }) => {
  await page.goto("/termekek");
  await page.getByRole("button", { name: /TitanWeave XXL.* kosárba tétele/ }).click();
  const cartButton = page.getByRole("banner").getByRole("button", { name: /^Kosár/ });
  await expect(cartButton).toHaveAccessibleName("Kosár, 1 termék");

  await page.reload();
  await expect(cartButton).toHaveAccessibleName("Kosár, 1 termék");
});

test("rendezés és akciós szűrő a katalógusban", async ({ page }) => {
  await page.goto("/termekek?rendezes=ar-novekvo&akcios=1");
  await expect(page.getByRole("link", { name: "Csak akciós" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  const names = await page
    .getByRole("article")
    .getByRole("heading", { level: 3 })
    .allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.length).toBeLessThan(8);
});

test("nem létező termék és kategória: a brand 404-oldala", async ({ page }) => {
  for (const path of ["/termek/nincs-ilyen", "/kategoria/nincs-ilyen"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Ez az ösvény zsákutca" })).toBeVisible();
  }
});
