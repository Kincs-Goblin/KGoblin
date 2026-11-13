import { defineConfig } from "@trigger.dev/sdk";

import { reportTaskFailure } from "./src/adapters/telemetry";
import { parseJobsEnv } from "./src/domain/env";

const jobsEnv = parseJobsEnv(process.env);

export default defineConfig({
  project: jobsEnv.TRIGGER_PROJECT_ID,
  runtime: "node",
  logLevel: "info",
  // A taskok maximális futásideje másodpercben (5 perc).
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  onFailure: async ({ payload, error, ctx }) => {
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
  },
});
