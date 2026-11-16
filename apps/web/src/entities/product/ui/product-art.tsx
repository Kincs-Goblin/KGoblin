"use client";

import { GemIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

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

function ProductImageWithFallback({
  image,
  rarity,
  sizes,
  priority,
}: {
  image: ProductImage;
  rarity: Rarity;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ProductArtPlaceholder rarity={rarity} label={image.alt || productTexts.noImage} />;
  }

  return (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      sizes={sizes ?? "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
      priority={priority}
      onError={() => setFailed(true)}
      className="object-cover"
    />
  );
}

export function ProductArtPlaceholder({ rarity, label }: { rarity: Rarity; label?: string }) {
  return (
    <div
      role="img"
      aria-label={label ?? productTexts.noImage}
      className={cn(
        "surface-stone absolute inset-0 flex flex-col items-center justify-center gap-2 bg-radial to-transparent to-70%",
        rarityGlow[rarity],
      )}
    >
      <GemIcon
        aria-hidden="true"
        strokeWidth={1.25}
        className={cn("size-1/3 drop-shadow-lg", rarityIcon[rarity])}
      />
    </div>
  );
}

/**
 * A „kártyakép”: Next.js által optimalizált termékfotó (`remotePatterns`, Cloudflare CDN / IMAGES binding:
 * ADR-0009, ADR-0013), vagy ha hiányzik / betöltési hiba történik, saját díszítő illusztráció a ritkaság színével.
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
        <ProductImageWithFallback
          key={image.src}
          image={image}
          rarity={rarity}
          sizes={sizes}
          priority={priority}
        />
      ) : (
        <ProductArtPlaceholder rarity={rarity} />
      )}
    </div>
  );
}
