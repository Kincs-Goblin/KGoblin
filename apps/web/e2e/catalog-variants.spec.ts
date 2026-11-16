import { expect, test } from "@playwright/test";

const shotDir = "../../output/ui-review/KG-9";
const takeShots = process.env.SCREENSHOTS === "1";

test("katalógus attribútum-, készlet-, árszűrés, rendezés és lapozás", async ({
  page,
}, testInfo) => {
  await page.goto("/termekek");
  const main = page.getByRole("main");
  await expect(main.getByText("12 termék", { exact: true })).toBeVisible();
  await expect(main.getByText("1. / 2 oldal")).toBeVisible();

  if (takeShots) {
    await page.screenshot({
      path: `${shotDir}/after-catalog-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }

  // Lapozás a 2. oldalra
  await main
    .getByRole("navigation", { name: /lapozó/i })
    .getByRole("link", { name: "2" })
    .click();
  await expect(page).toHaveURL(/oldal=2/);
  await expect(main.getByText("2. / 2 oldal")).toBeVisible();

  // Csak raktáron gyors szűrő (visszaállítja az oldalszámot 1-re)
  await main.getByRole("link", { name: "Csak raktáron" }).click();
  await expect(page).toHaveURL(/raktaron=1/);
  await expect(page).not.toHaveURL(/oldal=2/);
  await expect(main.getByText("10 termék", { exact: true })).toBeVisible();

  // Attribútumszűrés: desktopon oldalsáv, mobilon Sheet drawer
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: /Szűrők/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: /Goblin Arany/ }).click();
  } else {
    await page
      .getByRole("complementary", { name: /Szűrés/ })
      .getByRole("link", { name: /Goblin Arany/ })
      .click();
  }

  await expect(page).toHaveURL(/attr_pa_szin=goblin-arany/);

  if (takeShots) {
    await page.screenshot({
      path: `${shotDir}/after-catalog-filtered-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }

  // Szűrők törlése üres találati listáról
  await page.goto("/termekek?min=900000");
  await expect(main.getByText("Nincs a szűrésnek megfelelő termék")).toBeVisible();
  await main.getByRole("link", { name: "Szűrők visszaállítása" }).click();
  await expect(page).toHaveURL(/\/termekek$/);
});

test("variáns választás, készlet- és szállítási infó, képgaléria és kosár", async ({
  page,
}, testInfo) => {
  await page.goto("/termek/runakard-tkl-pro-vezetek-nelkuli-billentyuzet");
  await expect(page.getByText(/KG-GMR-VAR-009-RED-BLK/)).toBeVisible();
  await expect(page.getByText(/1–2 munkanap/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Goblin Arany" })).toBeDisabled();

  // Váltás Taktilis Brown variánsra -> Goblin Arany aktív, kevés készlet + akció + Omnibus
  await page.getByRole("button", { name: "Taktilis Brown" }).click();
  await expect(page.getByText(/KG-GMR-VAR-009-BRN-GLD/)).toBeVisible();
  await expect(page.getByText("Már csak 2 db")).toBeVisible();
  await expect(page.getByText(/Az elmúlt 30 nap legalacsonyabb ára:/)).toBeVisible();

  if (takeShots) {
    await page.screenshot({
      path: `${shotDir}/after-variable-product-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }

  // Galéria nagyítás megnyitása majd bezárása
  await page.getByRole("button", { name: "Nagyítás megnyitása" }).click();
  const zoomDialog = page.getByRole("dialog");
  await expect(zoomDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(zoomDialog).toBeHidden();

  // Variáció kosárba tétele -> megnyitás -> variáns címke látszik a drawerben
  await page
    .getByRole("main")
    .getByRole("button", { name: /kosárba tétele/ })
    .click();
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^Kosár/ })
    .click();
  const drawer = page.getByRole("dialog", { name: "Zsákmányod" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Taktilis Brown, Goblin Arany")).toBeVisible();
});
