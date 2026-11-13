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
