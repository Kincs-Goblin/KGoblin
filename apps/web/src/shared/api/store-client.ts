import "server-only";

import type { Brand } from "@kg/brand-config";
import { createWooClient, type StoreClient } from "@kg/woo-client";
import { createFixtureStoreClient } from "@kg/woo-client/fixtures";

import { serverEnv } from "../config/env";

/**
 * A brand Store API-kliense. Fixture csak kifejezett `KG_STORE_FIXTURES=1` mellett jön;
 * egyébként `createWooClient(brand)` oldja fel a brandhez tartozó Woo-címet (hiányzónál `WOO.UNAVAILABLE`).
 */
export function getStoreClient(brand: Brand): StoreClient {
  if (serverEnv.KG_STORE_FIXTURES === "1") return createFixtureStoreClient();
  return createWooClient(brand);
}
