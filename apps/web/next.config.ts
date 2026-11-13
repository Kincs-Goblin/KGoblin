import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kg/brand-config", "@kg/woo-client"],
  poweredByHeader: false,
  // A szabályforrás a gyökér AGENTS.md (ADR-0003, ADR-0006); a next dev ne generáljon saját AGENTS.md-t.
  agentRules: false,
};

export default nextConfig;
