import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/shared/lib/utils";

import { catalogTexts } from "../config/texts";
import { catalogHref, type CatalogQueryState } from "../model/query";

type CatalogPaginationProps = {
  basePath: string;
  query: CatalogQueryState;
  totalPages: number;
};

const paginationTexts = catalogTexts.filters;

export function CatalogPagination({ basePath, query, totalPages }: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  const currentPage = Math.min(Math.max(1, query.page), totalPages);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label={paginationTexts.paginationLabel}
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-6"
    >
      <p className="text-sm text-muted-foreground">
        {paginationTexts.pageInfo(currentPage, totalPages)}
      </p>

      <div className="flex items-center gap-1.5">
        {currentPage > 1 ? (
          <Link
            href={catalogHref(basePath, { ...query, page: currentPage - 1 })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-bronze/60 px-3 text-sm text-foreground transition-colors hover:border-gold hover:text-gold"
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
            {paginationTexts.prevPage}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/40 px-3 text-sm text-muted-foreground/50"
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
            {paginationTexts.prevPage}
          </span>
        )}

        <div className="flex items-center gap-1">
          {pages.map((pageNumber) => {
            const isCurrent = pageNumber === currentPage;
            return (
              <Link
                key={pageNumber}
                href={catalogHref(basePath, { ...query, page: pageNumber })}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                  isCurrent
                    ? "border-gold bg-gold text-gold-foreground"
                    : "border-bronze/60 text-foreground/90 hover:border-gold hover:text-gold",
                )}
              >
                {pageNumber}
              </Link>
            );
          })}
        </div>

        {currentPage < totalPages ? (
          <Link
            href={catalogHref(basePath, { ...query, page: currentPage + 1 })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-bronze/60 px-3 text-sm text-foreground transition-colors hover:border-gold hover:text-gold"
          >
            {paginationTexts.nextPage}
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/40 px-3 text-sm text-muted-foreground/50"
          >
            {paginationTexts.nextPage}
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
