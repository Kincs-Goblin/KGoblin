import { brands } from "@kg/brand-config";
import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import { z } from "zod";

import "./src/shared/config/env.client";
import {
  FIXTURES_IN_PRODUCTION_MESSAGE,
  isFixtureModeForbidden,
} from "./src/shared/config/env-guards";

const buildServerEnvSchema = z
  .object({
    KG_STORE_FIXTURES: z.enum(["0", "1"]).default("0"),
    NEXT_PUBLIC_APP_ENV: z.string().optional(),
  })
  // Ugyanaz az őr, mint a `serverEnv`-ben: éles build nem épülhet fixture-katalógusra.
  .refine((env) => !isFixtureModeForbidden(env.KG_STORE_FIXTURES, env.NEXT_PUBLIC_APP_ENV), {
    path: ["KG_STORE_FIXTURES"],
    message: FIXTURES_IN_PRODUCTION_MESSAGE,
  });

const buildEnvCheck = buildServerEnvSchema.safeParse({
  KG_STORE_FIXTURES: process.env.KG_STORE_FIXTURES || undefined,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || undefined,
});

if (!buildEnvCheck.success) {
  const issues = buildEnvCheck.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Érvénytelen szerveroldali környezeti változó (${issues})`);
}

// Pipeline-ben (GitHub Actions: `CI`, Cloudflare Workers Builds: `WORKERS_CI`) a környezet kötelező: a hiányzó
// érték csendben `local` lenne (loopback képek, nincs noindex, nincs fixture-őr). A config a build, a dev és a
// start előtt is betöltődik, ezért ott is érvényes. A `CI=false` / `CI=0` nem számít pipeline-nak.
const isTruthyEnv = (value: string | undefined) =>
  !!value && value !== "0" && value.toLowerCase() !== "false";
if (
  (isTruthyEnv(process.env.CI) || isTruthyEnv(process.env.WORKERS_CI)) &&
  !process.env.NEXT_PUBLIC_APP_ENV
) {
  throw new Error(
    "Hiányzó NEXT_PUBLIC_APP_ENV: CI- és Workers-környezetben kötelező (local | preview | demo | production).",
  );
}
const appEnv = process.env.NEXT_PUBLIC_APP_ENV || "local";
// Workers-build mindig távoli környezet: a `local` (loopback képek, nincs noindex) ott nem engedett.
if (isTruthyEnv(process.env.WORKERS_CI) && appEnv === "local") {
  throw new Error(
    "NEXT_PUBLIC_APP_ENV=local Workers-buildben nem engedett (preview | demo | production).",
  );
}
const isLocalApp = appEnv === "local";
// Nem lokális, élő Woo-ra épülő buildnél a brand Woo-címe kötelező: hiányában a katalógus csendben
// állandó WOO.UNAVAILABLE-t adna, a konfigurációs hiba pedig rejtve maradna.
if (!isLocalApp && process.env.KG_STORE_FIXTURES !== "1") {
  const missing = brands
    .map((brand) => brand.woo.baseUrlEnv)
    .filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Hiányzó Woo-cím (${missing.join(", ")}): ${appEnv} buildhez kötelező.`);
  }
}
const isNoIndex = appEnv === "preview" || appEnv === "demo";

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function toRemotePattern(rawUrl: string): RemotePattern | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const protocol = url.protocol === "https:" ? "https" : "http";
    return {
      protocol,
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

function collectImageRemotePatterns(): {
  remotePatterns: RemotePattern[];
  hasLoopback: boolean;
} {
  const seen = new Set<string>();
  const remotePatterns: RemotePattern[] = [];
  let hasLoopback = false;

  const pushPattern = (rawUrl: string | undefined) => {
    if (!rawUrl) return;
    const pattern = toRemotePattern(rawUrl.trim());
    if (!pattern) return;
    const key = `${pattern.protocol}://${pattern.hostname}:${pattern.port ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (isLoopbackHost(pattern.hostname)) hasLoopback = true;
    remotePatterns.push(pattern);
  };

  for (const brand of brands) {
    pushPattern(process.env[brand.woo.baseUrlEnv]);
  }

  const extraHosts = process.env.KG_MEDIA_REMOTE_HOSTS?.split(",") ?? [];
  for (const host of extraHosts) {
    pushPattern(host);
  }

  // Lokális fejlesztéshez / fixture buildhez a Docker Woo (localhost:8080) kizárólag local környezetben engedélyezett.
  if (isLocalApp) {
    pushPattern("http://localhost:8080");
    pushPattern("http://127.0.0.1:8080");
  }

  return { remotePatterns, hasLoopback };
}

const { remotePatterns, hasLoopback } = collectImageRemotePatterns();

const nextConfig: NextConfig = {
  transpilePackages: ["@kg/brand-config", "@kg/woo-client"],
  poweredByHeader: false,
  // A szabályforrás a gyökér AGENTS.md (ADR-0003, ADR-0006); a next dev ne generáljon saját AGENTS.md-t.
  agentRules: false,
  images: {
    remotePatterns,
    ...(hasLoopback && isLocalApp ? { dangerouslyAllowLocalIP: true } : {}),
  },
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
