import type { Brand } from "@kg/brand-config";

import type { Rarity } from "../model/types";

const tagToRarity: Record<string, Rarity> = {
  "ritkasag-gyakori": "common",
  "ritkasag-ritka": "rare",
  "ritkasag-epikus": "epic",
  "ritkasag-legendas": "legendary",
};

/**
 * Ritkaság: a Woo-tag (`ritkasag-<szint>`) az elsődleges; ha nincs, a normál ár sávja a brand-configból.
 * Csak megjelenítés: az árat nem módosítja, és nem számol vele.
 */
export function resolveRarity(
  tagSlugs: string[],
  regularPriceMinor: number,
  thresholds: Brand["merchandising"]["rarityThresholds"],
): Rarity {
  for (const slug of tagSlugs) {
    const fromTag = tagToRarity[slug];
    if (fromTag) return fromTag;
  }
  if (regularPriceMinor >= thresholds.legendary) return "legendary";
  if (regularPriceMinor >= thresholds.epic) return "epic";
  if (regularPriceMinor >= thresholds.rare) return "rare";
  return "common";
}
