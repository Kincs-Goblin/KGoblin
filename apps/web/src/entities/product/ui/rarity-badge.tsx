import { Badge } from "@/shared/ui/badge";

import { productTexts } from "../config/texts";
import type { Rarity } from "../model/types";

export function RarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <Badge variant={rarity} className={className}>
      {productTexts.rarity[rarity]}
    </Badge>
  );
}
