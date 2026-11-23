import { expect, test } from "@playwright/test";

test.describe("Termékkeresés (KG-10)", () => {
  test("fejléc-autocomplete találatot ad árral és a termékoldalra navigál", async ({ page }) => {
    await page.goto("/");

    const combobox = page
      .getByRole("combobox", { name: "Keresés a termékek között" })
      .locator("visible=true")
      .first();
    await combobox.fill("billentyűzet");

    const listbox = page.getByRole("listbox", { name: "Keresési javaslatok" });
    await expect(listbox).toBeVisible();
    const firstOption = listbox.getByRole("option").first();
    await expect(firstOption).toBeVisible();
    await expect(firstOption).toContainText("Ft");

    await firstOption.locator("a").click();
    await expect(page).toHaveURL(/\/termek\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/kereses?q= találati oldal noindex, facetekkel és rendezéssel működik", async ({
    page,
  }) => {
    await page.goto("/kereses?q=billentyuzet");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("billentyuzet");
    await expect(page.getByRole("article").first()).toBeVisible();

    await page.getByRole("link", { name: "Ár: növekvő" }).click();
    await expect(page).toHaveURL(/rendezes=price_asc/);

    await page.goto("/kereses?q=nemletezotermekxyz999");
    await expect(
      page.getByRole("heading", { name: "Nem találtunk ilyen zsákmányt" }),
    ).toBeVisible();
  });
});
