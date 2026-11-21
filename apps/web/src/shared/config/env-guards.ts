/**
 * Build (`next.config.ts`) és futás (`serverEnv`) közös őre: élesben a kitalált áras fixture-katalógus
 * soha nem szolgálható ki. Szerver- és kliensfüggetlen, ezért a next.config is importálhatja.
 */
export const FIXTURES_IN_PRODUCTION_MESSAGE = "production környezetben nem lehet 1";

export function isFixtureModeForbidden(fixtures: string | undefined, appEnv: string | undefined) {
  return fixtures === "1" && appEnv === "production";
}
