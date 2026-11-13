import { themeToCssVars, type Brand } from "@kg/brand-config";

import { fontVariableByKey } from "./fonts";

/**
 * A brand tokenjei CSS-változóként a `:root`-ra. Egy kérés egy brandet szolgál ki, így a portálok
 * (drawer, dialog) is megkapják a témát. Az értékeket a brand-config sémája validálja.
 */
export function BrandThemeStyle({ brand }: { brand: Brand }) {
  const vars: Record<string, string> = {
    ...themeToCssVars(brand.theme),
    "--font-heading": `var(${fontVariableByKey[brand.theme.fonts.heading]}), ui-serif, serif`,
    "--font-body": `var(${fontVariableByKey[brand.theme.fonts.body]}), ui-sans-serif, sans-serif`,
  };
  const css = `:root{${Object.entries(vars)
    .map(([name, value]) => `${name}:${value};`)
    .join("")}}`;

  return <style id={`brand-theme-${brand.id}`} dangerouslySetInnerHTML={{ __html: css }} />;
}
