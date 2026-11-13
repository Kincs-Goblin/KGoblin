import { SearchIcon } from "lucide-react";
import Link from "next/link";

import { routes } from "@/shared/config";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Input } from "@/shared/ui/input";

import { headerTexts } from "../config/texts";

export type HeaderNavItem = { href: string; label: string };

type HeaderProps = {
  brandName: string;
  tagline: string;
  nav: HeaderNavItem[];
  /** A kosár-gomb helye; az app-réteg tölti ki (a widgetek nem importálják egymást). */
  cart: React.ReactNode;
};

export function Header({ brandName, tagline, nav, cart }: HeaderProps) {
  const items = [{ href: routes.products, label: headerTexts.allProducts }, ...nav];

  return (
    <header className="surface-wood sticky top-0 z-40 border-b-2 border-gold/70 shadow-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:h-20 sm:px-6">
        <Link
          href={routes.home}
          aria-label={`${brandName} - ${headerTexts.homeLabel}`}
          className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
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
        <div className="relative ml-auto hidden w-full max-w-xs lg:block">
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

        <div className="ml-auto lg:ml-0">{cart}</div>
      </div>

      <nav
        aria-label={headerTexts.navLabel}
        className="border-t border-bronze/40 bg-surface-wood-dark/60"
      >
        <ul className="mx-auto flex max-w-7xl [scrollbar-width:none] gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
          {items.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className="block rounded-md px-3 py-1.5 font-heading text-sm tracking-wide text-foreground/90 transition-colors hover:bg-accent hover:text-gold focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
