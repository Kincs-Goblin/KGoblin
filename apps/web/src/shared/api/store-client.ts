import "server-only";

import type { Brand } from "@kg/brand-config";
import { createStoreClient, WooError, type StoreClient } from "@kg/woo-client";
import { createFixtureStoreClient } from "@kg/woo-client/fixtures";

import { getWooBaseUrl, serverEnv } from "../config/env";

/**
 * A brand Store API-kliense. Fixture csak kifejezett `KG_STORE_FIXTURES=1` mellett jön; ha nincs Woo-cím
 * és fixture sem, a hívás `WOO.UNAVAILABLE` (nem csendes hamis adat).
 */
export function getStoreClient(brand: Brand): StoreClient {
  if (serverEnv.KG_STORE_FIXTURES === "1") return createFixtureStoreClient();

  const baseUrl = getWooBaseUrl(brand);
  if (!baseUrl) {
    const missing = (): never => {
      throw new WooError("WOO.UNAVAILABLE", `Nincs beállítva: ${brand.woo.baseUrlEnv}`);
    };
    return { getProducts: missing, getProductBySlug: missing, getCategories: missing };
  }
  return createStoreClient({ baseUrl });
}
