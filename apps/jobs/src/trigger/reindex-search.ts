import { brands, getBrandById, type Brand } from "@kg/brand-config";
import { createWooClient, type StoreProduct } from "@kg/woo-client";
import { AbortTaskRunError, idempotencyKeys, logger, schedules, task } from "@trigger.dev/sdk";
import { z } from "zod";

import {
  createMeilisearchAdminClient,
  type MeilisearchAdminClient,
} from "../adapters/meilisearch/client";
import { getMeilisearchAdminConfig } from "../domain/env";
import { AppError, isAppError } from "../domain/errors";
import { buildBrandIdempotencyKey } from "../domain/heartbeat";
import {
  buildBrandIndexSettings,
  mapStoreProductToSearchDocument,
  type SearchProductDocument,
} from "../domain/search/schema";

export const fullReindexPayloadSchema = z.object({
  brandId: z.string().min(1),
});

export type FullReindexPayload = z.infer<typeof fullReindexPayloadSchema>;

export type FullReindexResult = {
  brandId: string;
  indexUid: string;
  indexedCount: number;
  durationMs: number;
};

export const reindexSearchPayloadSchema = z.object({
  brandId: z.string().min(1),
  productIds: z.array(z.number().int().positive()).min(1).max(200),
  correlationId: z.string().min(1).max(120).optional(),
});

export type ReindexSearchPayload = z.infer<typeof reindexSearchPayloadSchema>;

export type ReindexSearchResult = {
  brandId: string;
  indexUid: string;
  upserted: number;
  deleted: number;
  durationMs: number;
};

type StoreProductFetcher = {
  fetchAllProducts: (brand: Brand) => Promise<StoreProduct[]>;
  fetchProductsByIds: (brand: Brand, ids: readonly number[]) => Promise<StoreProduct[]>;
};

const STORE_PAGE_SIZE = 100;

function createWooStoreFetcher(env: NodeJS.ProcessEnv = process.env): StoreProductFetcher {
  return {
    async fetchAllProducts(brand) {
      const store = createWooClient(brand, { env });
      const first = await store.getProductsPage({ page: 1, perPage: STORE_PAGE_SIZE });
      const products = [...first.products];
      for (let page = 2; page <= first.totalPages; page += 1) {
        const next = await store.getProductsPage({ page, perPage: STORE_PAGE_SIZE });
        products.push(...next.products);
      }
      return products;
    },
    async fetchProductsByIds(brand, ids) {
      const store = createWooClient(brand, { env });
      // A Store API `include` szűrővel egy kérésben adja vissza a még publikus termékeket.
      const products: StoreProduct[] = [];
      for (let i = 0; i < ids.length; i += STORE_PAGE_SIZE) {
        const chunk = ids.slice(i, i + STORE_PAGE_SIZE);
        const page = await store.getProductsPage({
          include: chunk,
          perPage: chunk.length,
        });
        products.push(...page.products);
      }
      return products;
    },
  };
}

/**
 * Tiszta, tesztelhető teljes újraindexelés: ideiglenes index → beállítások → dokumentumok →
 * atomi `swapIndexes` (leállás nélkül) → régi temp index törlése.
 */
export async function runFullReindex(
  payload: FullReindexPayload,
  deps: {
    meili: MeilisearchAdminClient;
    fetcher: StoreProductFetcher;
    now?: () => number;
  },
): Promise<FullReindexResult> {
  const parsed = fullReindexPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("JOB.INVALID_PAYLOAD", {
      cause: parsed.error,
      internalReason: parsed.error.message,
    });
  }

  const brand = getBrandById(parsed.data.brandId);
  if (!brand) {
    throw new AppError("BRAND.UNKNOWN_ID", {
      internalReason: `Ismeretlen brandId: ${parsed.data.brandId}`,
    });
  }

  const now = deps.now ?? Date.now;
  const startedAt = now();
  const targetUid = brand.search.index;
  const tempUid = `${targetUid}_tmp_${startedAt}`;
  const settings = buildBrandIndexSettings();

  const products = await deps.fetcher.fetchAllProducts(brand);
  const documents: SearchProductDocument[] = products.map((product) =>
    mapStoreProductToSearchDocument(product, brand),
  );

  // Célindex létrehozása, ha még nem létezik (a swapIndexes két létező indexet vár).
  await deps.meili.ensureIndex(targetUid);
  await deps.meili.ensureIndex(tempUid);
  try {
    await deps.meili.applyIndexSettings(tempUid, settings);
    await deps.meili.upsertDocuments(tempUid, documents);
    await deps.meili.swapIndexes([{ indexes: [targetUid, tempUid] }]);
  } finally {
    // A swap után a tempUid a régi (vagy sikertelen) indexet jelöli; takarítjuk.
    await deps.meili.deleteIndex(tempUid).catch(() => {});
  }

  return {
    brandId: brand.id,
    indexUid: targetUid,
    indexedCount: documents.length,
    durationMs: Math.max(0, now() - startedAt),
  };
}

/**
 * Tiszta, tesztelhető inkrementális újraindexelés termék-ID-kra.
 * Ami a Store API-ban publikus → upsert; ami hiányzik (törölt / piszkozat / privát) → delete.
 */
export async function runIncrementalReindex(
  payload: ReindexSearchPayload,
  deps: {
    meili: MeilisearchAdminClient;
    fetcher: StoreProductFetcher;
    now?: () => number;
  },
): Promise<ReindexSearchResult> {
  const parsed = reindexSearchPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("JOB.INVALID_PAYLOAD", {
      cause: parsed.error,
      internalReason: parsed.error.message,
    });
  }

  const brand = getBrandById(parsed.data.brandId);
  if (!brand) {
    throw new AppError("BRAND.UNKNOWN_ID", {
      internalReason: `Ismeretlen brandId: ${parsed.data.brandId}`,
    });
  }

  const now = deps.now ?? Date.now;
  const startedAt = now();
  const uniqueIds = [...new Set(parsed.data.productIds)];
  const indexUid = brand.search.index;

  const publishedProducts = await deps.fetcher.fetchProductsByIds(brand, uniqueIds);
  const foundIds = new Set(publishedProducts.map((product) => product.id));
  const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
  const documents = publishedProducts.map((product) =>
    mapStoreProductToSearchDocument(product, brand),
  );

  const created = await deps.meili.ensureIndex(indexUid);
  if (created) {
    await deps.meili.applyIndexSettings(indexUid, buildBrandIndexSettings());
  }
  if (documents.length > 0) {
    await deps.meili.upsertDocuments(indexUid, documents);
  }
  if (missingIds.length > 0) {
    await deps.meili.deleteDocuments(indexUid, missingIds);
  }

  return {
    brandId: brand.id,
    indexUid,
    upserted: documents.length,
    deleted: missingIds.length,
    durationMs: Math.max(0, now() - startedAt),
  };
}

function handleTaskError(error: unknown): never {
  if (isAppError(error) && !error.retryable) {
    throw new AbortTaskRunError(`[${error.code}] ${error.userMessage}`);
  }
  throw error;
}

export const fullReindexSearchTask = task({
  id: "full-reindex-search",
  retry: { maxAttempts: 3 },
  run: async (payload: FullReindexPayload): Promise<FullReindexResult> => {
    try {
      const meili = createMeilisearchAdminClient(getMeilisearchAdminConfig());
      const fetcher = createWooStoreFetcher();
      const result = await runFullReindex(payload, { meili, fetcher });
      logger.info("Full Meilisearch reindex completed", result);
      return result;
    } catch (error) {
      handleTaskError(error);
    }
  },
});

export const scheduledFullReindexTask = schedules.task({
  id: "scheduled-full-reindex-search",
  // Napi biztonsági újraindexelés 03:30 UTC-kor minden regisztrált brandre.
  cron: "30 3 * * *",
  run: async () => {
    try {
      const meili = createMeilisearchAdminClient(getMeilisearchAdminConfig());
      const fetcher = createWooStoreFetcher();
      const summaries: FullReindexResult[] = [];
      for (const brand of brands) {
        const result = await runFullReindex({ brandId: brand.id }, { meili, fetcher });
        summaries.push(result);
        logger.info("Scheduled brand reindex completed", result);
      }
      return { brands: summaries };
    } catch (error) {
      handleTaskError(error);
    }
  },
});

export const reindexSearchTask = task({
  id: "reindex-search",
  retry: { maxAttempts: 3 },
  run: async (payload: ReindexSearchPayload): Promise<ReindexSearchResult> => {
    try {
      const meili = createMeilisearchAdminClient(getMeilisearchAdminConfig());
      const fetcher = createWooStoreFetcher();
      const result = await runIncrementalReindex(payload, { meili, fetcher });
      logger.info("Incremental Meilisearch reindex completed", result);
      return result;
    } catch (error) {
      handleTaskError(error);
    }
  },
});

/**
 * Inkrementális `reindex-search` task indítása brand-előtagos idempotencia-kulccsal.
 * Webhookból és a beszállítói feed-szinkronból egyaránt hívható.
 */
export async function triggerReindexSearch(payload: ReindexSearchPayload) {
  const parsed = reindexSearchPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("JOB.INVALID_PAYLOAD", {
      cause: parsed.error,
      internalReason: parsed.error.message,
    });
  }

  const brand = getBrandById(parsed.data.brandId);
  if (!brand) {
    throw new AppError("BRAND.UNKNOWN_ID", {
      internalReason: `Ismeretlen brandId: ${parsed.data.brandId}`,
    });
  }

  const sortedIds = [...new Set(parsed.data.productIds)].sort((a, b) => a - b).join("-");
  // Ha nincs explicit `correlationId` (pl. webhook delivery ID), 60 mp-es időablak-kulcsot használunk,
  // így a későbbi termékmódosítások nem ragadnak örök deduplikációba.
  const correlation = parsed.data.correlationId ?? `win-${Math.floor(Date.now() / 60_000)}`;
  const rawKey = buildBrandIdempotencyKey(
    "reindex-search",
    brand.id,
    `${sortedIds}:${correlation}`,
  );
  const idempotencyKey = await idempotencyKeys.create(rawKey, { scope: "global" });

  return reindexSearchTask.trigger(
    {
      brandId: brand.id,
      productIds: [...new Set(parsed.data.productIds)],
      ...(parsed.data.correlationId ? { correlationId: parsed.data.correlationId } : {}),
    },
    { idempotencyKey },
  );
}
