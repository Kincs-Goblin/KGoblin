import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { routes } from "@/shared/config";

import { categoryTexts } from "../config/texts";
import type { Category } from "../model/types";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={routes.category(category.slug)}
      className="frame-gold surface-wood group flex h-full items-center justify-between gap-4 rounded-xl p-5 transition-transform duration-200 hover:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span>
        <span className="block font-heading text-lg text-gold">{category.name}</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {categoryTexts.productCount(category.productCount)}
        </span>
      </span>
      <ChevronRightIcon
        aria-hidden="true"
        className="size-5 shrink-0 text-gold transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
      />
    </Link>
  );
}
