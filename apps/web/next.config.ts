import type { NextConfig } from "next";
import { z } from "zod";

import "./src/shared/config/env.client";

const buildServerEnvSchema = z.object({
  KG_STORE_FIXTURES: z.enum(["0", "1"]).default("0"),
});

const buildEnvCheck = buildServerEnvSchema.safeParse({
  KG_STORE_FIXTURES: process.env.KG_STORE_FIXTURES || undefined,
});

if (!buildEnvCheck.success) {
  const issues = buildEnvCheck.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Érvénytelen szerveroldali környezeti változó (${issues})`);
}

const isNoIndex =
  process.env.NEXT_PUBLIC_APP_ENV === "preview" || process.env.NEXT_PUBLIC_APP_ENV === "demo";

const nextConfig: NextConfig = {
  transpilePackages: ["@kg/brand-config", "@kg/woo-client"],
  poweredByHeader: false,
  // A szabályforrás a gyökér AGENTS.md (ADR-0003, ADR-0006); a next dev ne generáljon saját AGENTS.md-t.
  agentRules: false,
  async headers() {
    if (!isNoIndex) return [];
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
