// OpenNext Cloudflare konfiguráció (ADR-0009): ISR és data cache KV-ben (az R2 a fiókon nincs bekapcsolva),
// tag cache D1-ben a revalidateTag-hez, revalidálási sor Durable Objecttel.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: d1NextTagCache,
  queue: doQueue,
});
