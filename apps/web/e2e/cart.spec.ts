import { expect, test } from "@playwright/test";

/**
 * KG-12 teljes kosár-folyamat a BFF + httpOnly cookie + fixture Store API fölött:
 * kosárba → mennyiség → kupon (érvénytelen + GOBLIN10) → irányítószám és szállítási mód → újratöltés.
 */
test("kosár teljes folyamat: kosárba → mennyiség → kupon → szállítási mód → újratöltés", async ({
  page,
}) => {
  await page.goto("/termekek");
  await page.getByRole("button", { name: /TitanWeave XXL.* kosárba tétele/ }).click();

  const cartButton = page.getByRole("banner").getByRole("button", { name: /^Kosár/ });
  await expect(cartButton).toHaveAccessibleName("Kosár, 1 termék");

  // Drawer megnyitása és navigáció a /kosar oldalra
  await cartButton.click();
  const drawer = page.getByRole("dialog", { name: "Zsákmányod" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Kosár megtekintése" }).click();

  await expect(page).toHaveURL(/\/kosar$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Kosarad" })).toBeVisible();

  // A /kosar oldal minden környezetben noindex
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toContain("noindex");

  // Ingyenes szállítás sáv 25 000 Ft alatt ("Még X Ft az ingyenes szállításig")
  await expect(main.getByTestId("free-shipping-banner")).toContainText("az ingyenes szállításig");

  // Mennyiség növelése 1 -> 2
  const initialTotal = await main.getByTestId("cart-total").textContent();
  await main.getByRole("button", { name: /TitanWeave XXL.*eggyel több/ }).click();
  await expect(main.getByRole("group", { name: "Mennyiség" })).toContainText("2");
  await expect(main.getByTestId("cart-total")).not.toHaveText(initialTotal ?? "");

  // Érvénytelen kupon -> mezőszintű hiba
  await main.getByLabel("Kuponkód megadása").fill("ROSSZKUPON");
  await main.getByRole("button", { name: "Alkalmazás" }).click();
  await expect(main.getByRole("alert")).toContainText("kuponkód nem érvényes");

  // Érvényes kupon (GOBLIN10) -> kedvezmény megjelenik
  await main.getByLabel("Kuponkód megadása").fill("GOBLIN10");
  await main.getByRole("button", { name: "Alkalmazás" }).click();
  await expect(main.getByTestId("cart-discount")).toBeVisible();

  // Irányítószám kalkuláció és csomagautomata szállítási mód választása
  await main.getByLabel("Irányítószám").fill("1053");
  await main.getByRole("button", { name: "Szállítás kalkulálása" }).click();
  await expect(main.getByRole("button", { name: "Szállítás kalkulálása" })).toBeEnabled();

  await main.getByRole("radio", { name: /Csomagautomata/ }).check();
  await expect(main.getByRole("radio", { name: /Csomagautomata/ })).toBeChecked();
  await expect(main.getByTestId("pickup-point-slot")).toBeVisible();
  await expect(main.getByTestId("cart-shipping")).toContainText("990");

  // Újratöltés után minden megmarad a httpOnly cookie + BFF miatt
  const totalBeforeReload = await main.getByTestId("cart-total").textContent();
  await page.reload();
  await expect(main.getByRole("group", { name: "Mennyiség" })).toContainText("2");
  await expect(main.getByTestId("cart-discount")).toBeVisible();
  await expect(main.getByRole("radio", { name: /Csomagautomata/ })).toBeChecked();
  await expect(main.getByTestId("cart-total")).toHaveText(totalBeforeReload ?? "");

  // Kosár ürítése
  await main.getByRole("button", { name: "Kosár ürítése" }).click();
  await expect(
    main.getByRole("heading", { level: 1, name: "A kosarad jelenleg üres" }),
  ).toBeVisible();
  await expect(cartButton).toHaveAccessibleName("Kosár, üres");
});
