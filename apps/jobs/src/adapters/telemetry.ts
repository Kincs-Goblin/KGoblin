import { AbortTaskRunError } from "@trigger.dev/sdk";

import { isAppError, jobErrorCatalog, type JobErrorCode } from "../domain/errors";

export type FailureContext = {
  taskId: string;
  runId?: string | undefined;
  brandId?: string | undefined;
};

const abortCodePrefixRegex = /^\[([A-Z_]+\.[A-Z_]+)\]\s/;

function resolveErrorDetails(error: unknown): { code: JobErrorCode; retryable: boolean } {
  if (isAppError(error)) {
    return { code: error.code, retryable: error.retryable };
  }
  if (error instanceof Error) {
    if (isAppError(error.cause)) {
      return { code: error.cause.code, retryable: error.cause.retryable };
    }
    const match = abortCodePrefixRegex.exec(error.message);
    const candidate = match?.[1];
    if (candidate && candidate in jobErrorCatalog) {
      const code = candidate as JobErrorCode;
      return { code, retryable: jobErrorCatalog[code].retryable };
    }
  }
  return { code: "APP.UNEXPECTED", retryable: true };
}

/**
 * Előkészített hibajelentő hely (M5 / KG-88 Sentry-bekötésig).
 * Szabály (`kg-dev-practices`): token, jelszó, kártyaadat, teljes cím soha nem kerülhet logba vagy Sentrybe;
 * csak a stabil hibakód (`DOMAIN.REASON`), a taskId és a brandId rögzíthető.
 */
export function reportTaskFailure(error: unknown, context: FailureContext): void {
  const { code, retryable } = resolveErrorDetails(error);

  // TODO(KG-88): Sentry.captureException bekötése PII-szűrő beforeSend hookkal és brand taggel.
  console.error(
    JSON.stringify({
      level: "error",
      taskId: context.taskId,
      runId: context.runId,
      brandId: context.brandId,
      code,
      retryable,
    }),
  );
}

/**
 * Trigger.dev `catchError` / `handleError` hook:
 * Ha a dobott `AppError` `retryable: false` (pl. `JOB.INVALID_PAYLOAD`, `BRAND.UNKNOWN_ID`,
 * `SUPPLIER.ORDER_FORWARD_UNCERTAIN`), megszakítja az újrapróbálkozást (`AbortTaskRunError`),
 * hogy ne fusson le feleslegesen vagy veszélyesen újra.
 */
export function handleTaskError({
  error,
  ctx,
  payload,
}: {
  error: unknown;
  ctx: { task: { id: string }; run: { id: string } };
  payload?: unknown;
}) {
  const brandId =
    payload &&
    typeof payload === "object" &&
    "brandId" in payload &&
    typeof payload.brandId === "string"
      ? payload.brandId
      : undefined;

  if (isAppError(error) && !error.retryable) {
    reportTaskFailure(error, {
      taskId: ctx.task.id,
      runId: ctx.run.id,
      brandId,
    });
    return {
      skipRetrying: true,
      error: new AbortTaskRunError(`[${error.code}] ${error.userMessage}`),
    };
  }

  return undefined;
}
