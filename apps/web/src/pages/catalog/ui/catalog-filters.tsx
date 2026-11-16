"use client";

import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { Category } from "@/entities/category";
import type { CatalogFilterAttribute } from "@/entities/product";
import { routes } from "@/shared/config";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

import { catalogTexts } from "../config/texts";
import {
  catalogHref,
  countActiveFilters,
  sortOptions,
  toggleAttributeFilter,
  type CatalogQueryState,
  type SortKey,
} from "../model/query";

type CatalogFiltersProps = {
  basePath: string;
  activeCategory: Category | null;
  categories: Category[];
  attributes: CatalogFilterAttribute[];
  query: CatalogQueryState;
  total: number;
  currencyUnit?: string;
};

const filterTexts = catalogTexts.filters;

function FilterChip({
  href,
  active,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        active
          ? "border-gold bg-gold font-medium text-gold-foreground"
          : "border-bronze/60 text-foreground/90 hover:border-gold hover:text-gold",
      )}
    >
      {children}
    </Link>
  );
}

function PriceRangeForm({
  basePath,
  query,
  currencyUnit,
  onApplied,
}: {
  basePath: string;
  query: CatalogQueryState;
  currencyUnit: string;
  onApplied?: () => void;
}) {
  const router = useRouter();
  const [minInput, setMinInput] = useState(() =>
    query.minPrice !== undefined ? String(query.minPrice) : "",
  );
  const [maxInput, setMaxInput] = useState(() =>
    query.maxPrice !== undefined ? String(query.maxPrice) : "",
  );

  function parseInput(raw: string): number | undefined {
    const cleaned = raw.trim();
    if (!/^\d+$/.test(cleaned)) return undefined;
    return Number.parseInt(cleaned, 10);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    let minPrice = parseInput(minInput);
    let maxPrice = parseInput(maxInput);
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      [minPrice, maxPrice] = [maxPrice, minPrice];
    }
    const href = catalogHref(basePath, { ...query, minPrice, maxPrice, page: 1 });
    router.push(href, { scroll: false });
    onApplied?.();
  }

  const hasPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined;
  const minLabel = filterTexts.minPriceLabel(currencyUnit);
  const maxLabel = filterTexts.maxPriceLabel(currencyUnit);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="sr-only">{minLabel}</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={1_000_000_000}
            step={1}
            value={minInput}
            onChange={(event) => setMinInput(event.target.value)}
            placeholder={filterTexts.minPricePlaceholder}
            aria-label={minLabel}
            className="border-bronze/60 bg-background/80 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">{maxLabel}</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={1_000_000_000}
            step={1}
            value={maxInput}
            onChange={(event) => setMaxInput(event.target.value)}
            placeholder={filterTexts.maxPricePlaceholder}
            aria-label={maxLabel}
            className="border-bronze/60 bg-background/80 text-sm"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="flex-1 border-gold/60 text-gold hover:bg-gold/10"
        >
          {filterTexts.applyPrice}
        </Button>
        {hasPriceFilter ? (
          <Link
            href={catalogHref(basePath, {
              ...query,
              minPrice: undefined,
              maxPrice: undefined,
              page: 1,
            })}
            scroll={false}
            onClick={onApplied}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-gold"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
            {filterTexts.clearPrice}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function FilterSections({
  basePath,
  activeCategory,
  categories,
  attributes,
  query,
  currencyUnit = "Ft",
  onNavigate,
}: Omit<CatalogFiltersProps, "total"> & { onNavigate?: () => void }) {
  const activeCount = countActiveFilters(query);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {filterTexts.categoriesLabel}
        </h2>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <FilterChip
            href={catalogHref(routes.products, { ...query, page: 1 })}
            active={!activeCategory}
            onClick={onNavigate}
          >
            {filterTexts.allCategories}
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              href={catalogHref(routes.category(category.slug), { ...query, page: 1 })}
              active={activeCategory?.id === category.id}
              onClick={onNavigate}
            >
              {category.name}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="border-t border-border/40 pt-4">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {filterTexts.priceLabel(currencyUnit)}
        </h2>
        <div className="mt-2.5">
          <PriceRangeForm
            key={`${query.minPrice ?? ""}-${query.maxPrice ?? ""}`}
            basePath={basePath}
            query={query}
            currencyUnit={currencyUnit}
            onApplied={onNavigate}
          />
        </div>
      </div>

      {attributes.map((attribute) => (
        <div key={attribute.id} className="border-t border-border/40 pt-4">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {attribute.name}
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {attribute.terms.map((term) => {
              const isSelected = query.attributes.some(
                (item) => item.attribute === attribute.taxonomy && item.slug === term.slug,
              );
              const nextAttrs = toggleAttributeFilter(
                query.attributes,
                attribute.taxonomy,
                term.slug,
              );
              return (
                <FilterChip
                  key={term.slug}
                  href={catalogHref(basePath, { ...query, attributes: nextAttrs, page: 1 })}
                  active={isSelected}
                  onClick={onNavigate}
                >
                  <span>{term.name}</span>
                  <span className="text-xs opacity-75">({term.count})</span>
                </FilterChip>
              );
            })}
          </div>
        </div>
      ))}

      {activeCount > 0 ? (
        <div className="border-t border-border/40 pt-4">
          <Link
            href={catalogHref(basePath, { sort: query.sort, onSale: false })}
            scroll={false}
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gold underline-offset-4 hover:underline"
          >
            <XIcon className="size-4" aria-hidden="true" />
            {filterTexts.clearAllFilters}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function CatalogFilterToolbar({
  basePath,
  activeCategory,
  categories,
  attributes,
  query,
  total,
  currencyUnit,
}: CatalogFiltersProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveFilters(query);

  return (
    <div
      role="group"
      aria-label={filterTexts.filtersLabel}
      className="surface-wood mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bronze/40 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-bronze/60 lg:hidden"
              />
            }
          >
            <SlidersHorizontalIcon className="size-4 text-gold" aria-hidden="true" />
            <span>{filterTexts.filtersButton}</span>
            {activeCount > 0 ? (
              <span className="rounded-full bg-gold px-1.5 py-0.5 text-xs font-semibold text-gold-foreground">
                {activeCount}
              </span>
            ) : null}
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[88vw] max-w-sm overflow-y-auto border-bronze/50 bg-background"
          >
            <SheetHeader className="border-b border-border/50 pb-3">
              <SheetTitle className="font-heading text-lg">
                {filterTexts.filtersSheetTitle}
              </SheetTitle>
              <SheetDescription>{filterTexts.filtersSheetDescription}</SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <FilterSections
                basePath={basePath}
                activeCategory={activeCategory}
                categories={categories}
                attributes={attributes}
                query={query}
                currencyUnit={currencyUnit}
                onNavigate={() => setSheetOpen(false)}
              />
            </div>
            <SheetFooter className="border-t border-border/50 pt-3">
              <SheetClose render={<Button className="w-full" />}>
                {filterTexts.showResults(total)}
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <FilterChip
          href={catalogHref(basePath, { ...query, onSale: !query.onSale, page: 1 })}
          active={query.onSale}
        >
          {filterTexts.onSaleOnly}
        </FilterChip>
        <FilterChip
          href={catalogHref(basePath, { ...query, inStockOnly: !query.inStockOnly, page: 1 })}
          active={query.inStockOnly}
        >
          {filterTexts.inStockOnly}
        </FilterChip>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{filterTexts.sortLabel}:</span>
        <select
          aria-label={filterTexts.sortLabel}
          value={query.sort}
          onChange={(event) => {
            const nextSort = event.target.value as SortKey;
            router.push(catalogHref(basePath, { ...query, sort: nextSort, page: 1 }), {
              scroll: false,
            });
          }}
          className="h-8 rounded-lg border border-bronze/60 bg-background px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          {(Object.keys(sortOptions) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {filterTexts.sort[key]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function CatalogFilterSidebar(props: Omit<CatalogFiltersProps, "total">) {
  return (
    <aside
      aria-label={filterTexts.filtersLabel}
      className="surface-wood hidden self-start rounded-xl border border-bronze/40 p-4 lg:block"
    >
      <FilterSections {...props} />
    </aside>
  );
}
