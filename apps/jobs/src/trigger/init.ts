import { tasks } from "@trigger.dev/sdk";

import { reportTaskFailure } from "../adapters/telemetry";

tasks.onFailure(({ payload, error, ctx }) => {
  const brandId =
    payload &&
    typeof payload === "object" &&
    "brandId" in payload &&
    typeof payload.brandId === "string"
      ? payload.brandId
      : undefined;

  reportTaskFailure(error, {
    taskId: ctx.task.id,
    runId: ctx.run.id,
    brandId,
  });
});
