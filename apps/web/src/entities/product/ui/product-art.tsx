import { GemIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/shared/lib/utils";

import { productTexts } from "../config/texts";
import type { ProductImage, Rarity } from "../model/types";

const rarityGlow: Record<Rarity, string> = {
  common: "from-rarity-common/25",
  rare: "from-rarity-rare/35",
  epic: "from-rarity-epic/35",
  legendary: "from-rarity-legendary/45",
};

const rarityIcon: Record<Rarity, string> = {
  common: "text-rarity-common",
  rare: "text-rarity-rare",
  epic: "text-rarity-epic",
  legendary: "text-rarity-legendary",
};

type ProductArtProps = {
  image: ProductImage | null;
  rarity: Rarity;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/**
 * A „kártyakép”: a termékfotó, vagy ha nincs, saját díszítő illusztráció a ritkaság színével.
 * A Woo-képek egyelőre optimalizálás nélkül jönnek (a kép-CDN nyitott döntés a kg-stackben).
 */
export function ProductArt({ image, rarity, className, sizes, priority }: ProductArtProps) {
  return (
    <div
      className={cn(
        "surface-stone relative aspect-square overflow-hidden rounded-lg border border-bronze/50",
        className,
      )}
    >
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          unoptimized
          sizes={sizes ?? "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={productTexts.noImage}
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-radial to-transparent to-70%",
            rarityGlow[rarity],
          )}
        >
          <GemIcon
            aria-hidden="true"
            strokeWidth={1.25}
            className={cn("size-1/3 drop-shadow-lg", rarityIcon[rarity])}
          />
        </div>
      )}
    </div>
  );
}
