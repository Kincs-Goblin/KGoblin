import { ProductCard, type Product } from "@/entities/product";
import { AddToCartButton } from "@/features/add-to-cart";
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
                <AddToCartButton
                  product={{
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    price: product.price.current,
                  }}
                  disabled={!product.inStock || !product.purchasable}
                />
              }
            />
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
