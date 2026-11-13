import { getBrandById } from "@kg/brand-config";
import { AbortTaskRunError, idempotencyKeys, logger, task } from "@trigger.dev/sdk";

import { AppError, isAppError } from "../domain/errors";
import {
  brandHeartbeatPayloadSchema,
  buildBrandIdempotencyKey,
  runBrandHeartbeat,
  type BrandHeartbeatPayload,
  type BrandHeartbeatResult,
} from "../domain/heartbeat";

/**
 * Minta Trigger.dev task (`brand-heartbeat`):
 * - brand-paraméterrel és globális idempotencia-kulccsal (`brand-heartbeat:<brand>:<correlationId>`) fut;
 * - vékony wrapper a `domain/heartbeat.ts` tiszta üzleti logikája körül;
 * - `retryable: false` hiba esetén `AbortTaskRunError`-t dob, így nem próbálja újra.
 */
export const brandHeartbeatTask = task({
  id: "brand-heartbeat",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: BrandHeartbeatPayload): Promise<BrandHeartbeatResult> => {
    try {
      const result = runBrandHeartbeat(payload);
      logger.info("Brand heartbeat verified", {
        brandId: result.brandId,
        idempotencyKey: result.idempotencyKey,
      });
      return result;
    } catch (error) {
      if (isAppError(error) && !error.retryable) {
        throw new AbortTaskRunError(`[${error.code}] ${error.userMessage}`);
      }
      throw error;
    }
  },
});

/**
 * Segédfüggvény a `brand-heartbeat` task idempotens indításához (`scope: "global"`).
 * A kulcsépítés előtt validálja a payloadot és a brand-azonosítót.
 */
export async function triggerBrandHeartbeat(payload: BrandHeartbeatPayload) {
  const parsed = brandHeartbeatPayloadSchema.parse(payload);
  const brand = getBrandById(parsed.brandId);
  if (!brand) {
    throw new AppError("BRAND.UNKNOWN_ID", {
      internalReason: `Unknown brandId: ${parsed.brandId}`,
    });
  }

  const rawKey = buildBrandIdempotencyKey("brand-heartbeat", brand.id, parsed.correlationId);
  const idempotencyKey = await idempotencyKeys.create(rawKey, { scope: "global" });
  return brandHeartbeatTask.trigger(
    { brandId: brand.id, correlationId: parsed.correlationId },
    { idempotencyKey },
  );
}
