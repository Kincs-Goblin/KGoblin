import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_kgoblin",
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
});
