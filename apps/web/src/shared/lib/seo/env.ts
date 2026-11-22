import { clientEnv } from "@/shared/config";

/** Kizárólag `production` környezetben indexelhetők a keresőmotorok számára az oldalak. */
export function isIndexableEnv(appEnv: string = clientEnv.NEXT_PUBLIC_APP_ENV): boolean {
  return appEnv === "production";
}
