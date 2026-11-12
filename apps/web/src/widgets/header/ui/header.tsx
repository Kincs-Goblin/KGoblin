import { SearchIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";

import { routes } from "@/shared/config";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { headerTexts } from "../config/texts";

type HeaderProps = {
  brandName: string;
  tagline: string;
};

export function Header({ brandName, tagline }: HeaderProps) {
  return (
    <header className="surface-wood sticky top-0 z-40 border-b-2 border-gold/70 shadow-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:h-20 sm:px-6">
        <Link
          href={routes.home}
          aria-label={`${brandName} - ${headerTexts.homeLabel}`}
          className="flex items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <BrandMark className="size-9 sm:size-11" />
          <span className="flex flex-col leading-none">
            <span className="text-engraved font-heading text-lg font-bold tracking-wider sm:text-2xl">
              {brandName}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">{tagline}</span>
          </span>
        </Link>

        {/* A keresés a Meilisearch-ticketben jön; addig csak a helye látszik. */}
        <div className="relative ml-auto hidden w-full max-w-sm md:block">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            disabled
            aria-label={headerTexts.searchLabel}
            placeholder={headerTexts.searchPlaceholder}
            className="h-10 bg-surface-wood-dark/70 pl-9"
          />
        </div>

        <Button
          variant="outline"
          size="icon-lg"
          disabled
          aria-label={headerTexts.cartLabel}
          className="relative ml-auto size-11 border-gold/60 bg-surface-wood-dark/60 md:ml-0"
        >
          <ShoppingBagIcon className="size-5 text-gold" />
        </Button>
      </div>
    </header>
  );
}
