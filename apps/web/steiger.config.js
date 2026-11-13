import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // A tesztfájlok nem részei a szeletek public API-jának.
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
  },
]);
