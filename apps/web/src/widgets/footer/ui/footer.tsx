import Link from "next/link";

import { BrandMark } from "@/shared/ui/brand-mark";

import { footerTexts } from "../config/texts";

type FooterProps = {
  brandName: string;
  note: string;
};

export function Footer({ brandName, note }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="surface-stone mt-16 border-t-2 border-bronze/70">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6">
        <div className="flex items-start gap-3">
          <BrandMark className="size-10" />
          <div>
            <p className="font-heading text-lg text-gold">{brandName}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{note}</p>
          </div>
        </div>
        <nav aria-label={footerTexts.legalHeading} className="sm:justify-self-end">
          <h2 className="font-heading text-sm text-gold">{footerTexts.legalHeading}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {footerTexts.legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-foreground/85 underline-offset-4 hover:text-gold hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="border-t border-border/40 px-4 py-4 text-center text-xs text-muted-foreground">
        © {year} {brandName}. {footerTexts.rights}
      </p>
    </footer>
  );
}
