"use client";

import { SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { routes } from "@/shared/config";
import { formatMoney } from "@/shared/lib/format";
import { Input } from "@/shared/ui/input";

import { searchFeatureTexts } from "../config/texts";
import { HighlightedText } from "../lib/highlight";

type AutocompleteHit = {
  id: number;
  name: string;
  highlightedName: string;
  slug: string;
  priceMinor: number;
  currency: string;
  minorUnit: number;
  inStock: boolean;
  imageUrl: string | null;
  imageAlt: string;
};

type AutocompleteResponse =
  | { ok: true; hits: AutocompleteHit[]; totalHits: number }
  | { ok: false; code?: string; message?: string };

type SearchAutocompleteProps = {
  locale: string;
  className?: string;
};

const DEBOUNCE_MS = 200;

/**
 * Fejléc-kereső WAI-ARIA combobox mintával (debounce, termékkép, ár, kiemelt egyezés,
 * billentyűzetes navigáció). Kizárólag a Next.js BFF `/api/search` végpontot hívja (ADR-0012).
 */
export function SearchAutocomplete({ locale, className }: SearchAutocompleteProps) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hits, setHits] = useState<AutocompleteHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=6`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const data = (await res.json()) as AutocompleteResponse;
        if (!res.ok || !data.ok) {
          setHits([]);
          setTotalHits(0);
          setErrorMessage((!data.ok && data.message) || searchFeatureTexts.error);
          return;
        }
        setHits(data.hits);
        setTotalHits(data.totalHits);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        setHits([]);
        setTotalHits(0);
        setErrorMessage(searchFeatureTexts.error);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const showDropdown = open && trimmed.length >= 2;
  const activeOptionId =
    activeIndex >= 0 && activeIndex < hits.length
      ? `${listboxId}-opt-${hits[activeIndex]!.id}`
      : undefined;

  function navigateToSearch() {
    if (!trimmed) return;
    setOpen(false);
    router.push(`${routes.search}?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!showDropdown || hits.length === 0) {
      if (event.key === "Enter") {
        event.preventDefault();
        navigateToSearch();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? hits.length - 1 : prev - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && hits[activeIndex]) {
        const target = hits[activeIndex]!;
        setOpen(false);
        router.push(routes.product(target.slug));
      } else {
        navigateToSearch();
      }
    }
  }

  return (
    <div
      ref={containerRef}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
      className={className ? `relative ${className}` : "relative"}
    >
      <form
        role="search"
        action={routes.search}
        onSubmit={(event) => {
          event.preventDefault();
          navigateToSearch();
        }}
        className="relative"
      >
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (next.trim().length < 2) {
              setHits([]);
              setTotalHits(0);
              setErrorMessage(null);
              setLoading(false);
              setActiveIndex(-1);
            }
          }}
          onFocus={() => {
            if (trimmed.length >= 2) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          aria-label={searchFeatureTexts.label}
          placeholder={searchFeatureTexts.placeholder}
          autoComplete="off"
          className="h-10 bg-surface-wood-dark/70 pr-9 pl-9"
        />
        {query ? (
          <button
            type="button"
            aria-label={searchFeatureTexts.clearLabel}
            onClick={() => {
              setQuery("");
              setHits([]);
              setTotalHits(0);
              setErrorMessage(null);
              setLoading(false);
              setActiveIndex(-1);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={searchFeatureTexts.listboxLabel}
          className="surface-stone absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-gold/50 shadow-card"
        >
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground" role="status">
              {searchFeatureTexts.loading}
            </p>
          ) : errorMessage ? (
            <p className="px-4 py-3 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{searchFeatureTexts.empty}</p>
          ) : (
            <>
              <ul className="divide-y divide-bronze/30">
                {hits.map((hit, index) => {
                  const isActive = index === activeIndex;
                  const priceLabel = formatMoney(
                    {
                      amount: String(hit.priceMinor),
                      currency: hit.currency,
                      minorUnit: hit.minorUnit,
                    },
                    locale,
                  );
                  return (
                    <li
                      key={hit.id}
                      id={`${listboxId}-opt-${hit.id}`}
                      role="option"
                      aria-selected={isActive}
                      className={isActive ? "bg-accent/70" : "hover:bg-accent/40"}
                    >
                      <Link
                        href={routes.product(hit.slug)}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 transition-colors"
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-bronze/40 bg-surface-wood-dark/80">
                          {hit.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={hit.imageUrl}
                              alt={hit.imageAlt}
                              width={44}
                              height={44}
                              className="size-full object-cover"
                            />
                          ) : (
                            <SearchIcon
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            <HighlightedText text={hit.highlightedName} />
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs">
                            <span className="font-semibold text-gold">{priceLabel}</span>
                            {!hit.inStock ? (
                              <span className="text-muted-foreground">
                                {searchFeatureTexts.outOfStock}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-bronze/40 bg-surface-wood-dark/60 px-3.5 py-2">
                <Link
                  href={`${routes.search}?q=${encodeURIComponent(trimmed)}`}
                  onClick={() => setOpen(false)}
                  className="block text-center text-xs font-semibold text-gold underline-offset-4 hover:underline"
                >
                  {searchFeatureTexts.viewAll(totalHits)}
                </Link>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
