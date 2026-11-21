import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

import base from "@kg/config/eslint/base";

export default defineConfig([
  ...base,
  ...nextVitals,
  ...nextTs,
  {
    // FSD public API: szeleten kívülről csak `@/<réteg>/<szelet>` vagy `…/index.server` importálható.
    // A Steiger csak a `src/`-t nézi; ez az `app/` routing-mappát is lefedi (kg-architecture).
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/(app|pages|widgets|features|entities)/[^/]+/(?!index\\.server$).+",
              message: "Csak a szelet public API-ja importálható (index.ts vagy index.server.ts).",
            },
            {
              regex: "^(\\.\\./)+(src/|(app|pages|widgets|features|entities|shared)/)",
              message: "Réteg- vagy szeletközi import csak `@/` aliasszal, a public API-n át.",
            },
            {
              regex: "^@/shared/[^/]+/[^/]+/.+",
              message: "A shared szegmensből csak a modul belépési pontja importálható.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
