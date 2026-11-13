import Link from "next/link";

import { routes } from "@/shared/config";

import type { Product } from "../model/types";
import { CardMotion } from "./card-motion";
import { ProductArt } from "./product-art";
import { ProductPrice } from "./product-price";
import { RarityBadge } from "./rarity-badge";
import { StockLabel } from "./stock-label";

type ProductCardProps = {
  product: Product;
  /** A kártya alján lévő művelet (pl. kosárba tétel); a hívó réteg adja, az entitás nem ismeri. */
  action?: React.ReactNode;
};

export function ProductCard({ product, action }: ProductCardProps) {
  return (
    <CardMotion rarity={product.rarity}>
      <Link
        href={routes.product(product.slug)}
        className="flex flex-1 flex-col gap-3 rounded-lg focus-visible:outline-none"
      >
        <div className="relative">
          <ProductArt image={product.image} rarity={product.rarity} />
          <RarityBadge rarity={product.rarity} className="absolute top-2 left-2" />
        </div>
        <h3 className="line-clamp-2 font-heading text-sm leading-snug text-foreground group-hover:text-gold sm:text-base">
          {product.name}
        </h3>
      </Link>
      <div className="mt-3 flex flex-col gap-2">
        <ProductPrice price={product.price} />
        <StockLabel inStock={product.inStock} lowStockRemaining={product.lowStockRemaining} />
        {action}
      </div>
    </CardMotion>
  );
}
