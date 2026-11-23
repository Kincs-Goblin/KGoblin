import type { Brand } from "@kg/brand-config";
import { z } from "zod";

import { AppError } from "../../domain/errors";
import type { MeilisearchIndexSettings, SearchProductDocument } from "../../domain/search/schema";

const enqueuedTaskSchema = z.object({
  taskUid: z.number().int().nonnegative(),
});

const taskStatusSchema = z.object({
  uid: z.number().int().nonnegative(),
  status: z.enum(["enqueued", "processing", "succeeded", "failed", "canceled"]),
  error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const apiKeySchema = z.object({
  key: z.string().min(1),
  uid: z.string().min(1),
  name: z.string().nullable().optional(),
  actions: z.array(z.string()),
  indexes: z.array(z.string()),
  expiresAt: z.string().nullable().optional(),
});

const apiKeyListSchema = z.object({
  results: z.array(apiKeySchema),
});

export type MeilisearchApiKey = z.infer<typeof apiKeySchema>;

export type MeilisearchAdminClientOptions = {
  host: string;
  masterKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type MeilisearchAdminClient = {
  /** Létrehozza az indexet ha még nem létezik; `true`, ha frissen jött létre. */
  ensureIndex: (uid: string, primaryKey?: string) => Promise<boolean>;
  applyIndexSettings: (uid: string, settings: MeilisearchIndexSettings) => Promise<void>;
  upsertDocuments: (uid: string, documents: readonly SearchProductDocument[]) => Promise<void>;
  deleteDocuments: (uid: string, ids: readonly number[]) => Promise<void>;
  swapIndexes: (swaps: ReadonlyArray<{ indexes: [string, string] }>) => Promise<void>;
  deleteIndex: (uid: string) => Promise<void>;
  ensureBrandSearchKey: (brand: Brand) => Promise<MeilisearchApiKey>;
};

const UPSERT_BATCH_SIZE = 500;

/**
 * Szerveroldali Meilisearch admin kliens (kizárólag `@kg/jobs` számára, master kulccsal; ADR-0012).
 * Minden válasz Zod-dal validálva, minden aszinkron művelet megvárja a Meilisearch task befejezését.
 */
export function createMeilisearchAdminClient(
  options: MeilisearchAdminClientOptions,
): MeilisearchAdminClient {
  const baseUrl = options.host.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;

  async function request<T>(
    path: string,
    init: { method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown },
    schema: z.ZodType<T>,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${options.masterKey}`,
          Accept: "application/json",
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AppError("SEARCH.UNAVAILABLE", {
        cause: error,
        internalReason: `Meilisearch hálózati hiba (${init.method} ${path})`,
      });
    }

    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? "SEARCH.UNAVAILABLE" : "SEARCH.INVALID_RESPONSE",
        {
          internalReason: `Meilisearch HTTP ${response.status} (${init.method} ${path})`,
        },
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw new AppError("SEARCH.INVALID_RESPONSE", {
        cause: error,
        internalReason: `Meilisearch nem JSON válasz (${init.method} ${path})`,
      });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("SEARCH.INVALID_RESPONSE", {
        cause: parsed.error,
        internalReason: `Meilisearch válaszséma-eltérés (${init.method} ${path})`,
      });
    }
    return parsed.data;
  }

  async function waitForTask(taskUid: number, pollTimeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + pollTimeoutMs;
    while (Date.now() < deadline) {
      const task = await request(`/tasks/${taskUid}`, { method: "GET" }, taskStatusSchema);
      if (task.status === "succeeded") return;
      if (task.status === "failed" || task.status === "canceled") {
        throw new AppError("SEARCH.TASK_FAILED", {
          internalReason: `Meilisearch task #${taskUid} ${task.status}: ${task.error?.message ?? "ismeretlen hiba"}`,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new AppError("SEARCH.TASK_FAILED", {
      internalReason: `Meilisearch task #${taskUid} időtúllépés (${pollTimeoutMs}ms)`,
    });
  }

  return {
    async ensureIndex(uid, primaryKey = "id") {
      const enqueued = await request(
        "/indexes",
        { method: "POST", body: { uid, primaryKey } },
        enqueuedTaskSchema,
      );
      try {
        await waitForTask(enqueued.taskUid);
        return true;
      } catch (error) {
        // Az `index_already_exists` idempotens állapot — csak valódi hibát dobunk tovább.
        if (
          error instanceof AppError &&
          error.code === "SEARCH.TASK_FAILED" &&
          error.internalReason?.includes("already exists")
        ) {
          return false;
        }
        throw error;
      }
    },

    async applyIndexSettings(uid, settings) {
      const enqueued = await request(
        `/indexes/${encodeURIComponent(uid)}/settings`,
        { method: "PATCH", body: settings },
        enqueuedTaskSchema,
      );
      await waitForTask(enqueued.taskUid);
    },

    async upsertDocuments(uid, documents) {
      for (let i = 0; i < documents.length; i += UPSERT_BATCH_SIZE) {
        const batch = documents.slice(i, i + UPSERT_BATCH_SIZE);
        const enqueued = await request(
          `/indexes/${encodeURIComponent(uid)}/documents?primaryKey=id`,
          { method: "POST", body: batch },
          enqueuedTaskSchema,
        );
        await waitForTask(enqueued.taskUid);
      }
    },

    async deleteDocuments(uid, ids) {
      if (ids.length === 0) return;
      const enqueued = await request(
        `/indexes/${encodeURIComponent(uid)}/documents/delete-batch`,
        { method: "POST", body: ids },
        enqueuedTaskSchema,
      );
      await waitForTask(enqueued.taskUid);
    },

    async swapIndexes(swaps) {
      const enqueued = await request(
        "/swap-indexes",
        { method: "POST", body: swaps },
        enqueuedTaskSchema,
      );
      await waitForTask(enqueued.taskUid);
    },

    async deleteIndex(uid) {
      const enqueued = await request(
        `/indexes/${encodeURIComponent(uid)}`,
        { method: "DELETE" },
        enqueuedTaskSchema,
      );
      await waitForTask(enqueued.taskUid);
    },

    async ensureBrandSearchKey(brand) {
      const keyName = `kg-search-${brand.id}`;
      const existing = await request("/keys?limit=100", { method: "GET" }, apiKeyListSchema);
      const matched = existing.results.find(
        (item) =>
          item.name === keyName &&
          item.actions.length === 1 &&
          item.actions[0] === "search" &&
          item.indexes.length === 1 &&
          item.indexes[0] === brand.search.index,
      );
      if (matched) return matched;

      return request(
        "/keys",
        {
          method: "POST",
          body: {
            name: keyName,
            description: `Search-only BFF key for brand ${brand.id} (${brand.search.index})`,
            actions: ["search"],
            indexes: [brand.search.index],
            expiresAt: null,
          },
        },
        apiKeySchema,
      );
    },
  };
}
