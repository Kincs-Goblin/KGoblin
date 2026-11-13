import { getBrandById, type Brand } from "@kg/brand-config";
import { z } from "zod";

import { AppError } from "./errors";

export const brandHeartbeatPayloadSchema = z.object({
  brandId: z.string().min(1),
  correlationId: z.string().min(1),
});

export type BrandHeartbeatPayload = z.infer<typeof brandHeartbeatPayloadSchema>;

export type BrandHeartbeatResult = {
  ok: true;
  brandId: string;
  brandName: string;
  idempotencyKey: string;
  searchIndex: string;
};

/**
 * Minden Trigger.dev task idempotencia-kulccsal indul, brand-előtaggal: `<taskId>:<brand>:<businessKey>`.
 * Így két azonos webhook vagy ütemezett futás nem duplikálja a mellékhatást.
 */
export function buildBrandIdempotencyKey(taskName: string, brandId: string, key: string): string {
  const normalizedTask = taskName.trim();
  const normalizedBrand = brandId.trim().toLowerCase();
  const normalizedKey = key.trim();
  if (!normalizedTask || !normalizedBrand || !normalizedKey) {
    throw new AppError("JOB.INVALID_PAYLOAD", {
      internalReason: "Empty taskName, brandId, or key when building idempotency key",
    });
  }
  return `${normalizedTask}:${normalizedBrand}:${normalizedKey}`;
}

/**
 * Tiszta domain-függvény a minta (`brand-heartbeat`) taskhoz: ellenőrzi a payloadot és a brand-configot.
 */
export function runBrandHeartbeat(input: unknown): BrandHeartbeatResult {
  const parsed = brandHeartbeatPayloadSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("JOB.INVALID_PAYLOAD", {
      cause: parsed.error,
      internalReason: parsed.error.message,
    });
  }

  const brand: Brand | undefined = getBrandById(parsed.data.brandId);
  if (!brand) {
    throw new AppError("BRAND.UNKNOWN_ID", {
      internalReason: `Unknown brandId: ${parsed.data.brandId}`,
    });
  }

  const idempotencyKey = buildBrandIdempotencyKey(
    "brand-heartbeat",
    brand.id,
    parsed.data.correlationId,
  );

  return {
    ok: true,
    brandId: brand.id,
    brandName: brand.name,
    idempotencyKey,
    searchIndex: brand.search.index,
  };
}
