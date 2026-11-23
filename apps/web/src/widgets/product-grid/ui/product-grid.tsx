import Link from "next/link";

import { ProductCard, type Product } from "@/entities/product";
import { AddToCartButton } from "@/features/add-to-cart";
import { routes } from "@/shared/config";
import { buttonVariants } from "@/shared/ui/button";
import { Reveal, stagger } from "@/shared/ui/motion";

import { productGridTexts } from "../config/texts";

type ProductGridProps = {
  products: Product[];
  /** Egyedi rács-osztályok; alapból 2 oszlop mobilon, 4 desktopon. */
  className?: string;
};

export function ProductGrid({ products, className }: ProductGridProps) {
  if (products.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">{productGridTexts.empty}</p>;
  }

  return (
    <ul className={className ?? "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4"}>
      {products.map((product, index) => (
        <li key={product.id}>
          <Reveal delay={Math.min(index, 8) * stagger} className="h-full">
            <ProductCard
              product={product}
              action={
                product.type === "variable" || product.variations.length > 0 ? (
                  <Link
                    href={routes.product(product.slug)}
                    className={buttonVariants({
                      variant: "outline",
                      className: "h-9 w-full border-gold/60 text-gold hover:bg-gold/10",
                    })}
                  >
                    {productGridTexts.chooseVariant}
                  </Link>
                ) : (
                  <AddToCartButton
                    product={{
                      id: product.id,
                      slug: product.slug,
                      name: product.name,
                    }}
                    disabled={!product.inStock || !product.purchasable}
                  />
                )
              }
            />
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
