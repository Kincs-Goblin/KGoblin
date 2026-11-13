import Link from "next/link";

import { routes } from "@/shared/config";
import { buttonVariants } from "@/shared/ui/button";

import { notFoundTexts } from "../config/texts";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <p className="text-engraved font-heading text-7xl font-black">404</p>
      <h1 className="mt-4 text-2xl font-bold text-gold sm:text-3xl">{notFoundTexts.title}</h1>
      <p className="mt-3 text-muted-foreground">{notFoundTexts.description}</p>
      <Link
        href={routes.home}
        className={buttonVariants({ size: "lg", className: "mt-8 h-11 px-6" })}
      >
        {notFoundTexts.back}
      </Link>
    </section>
  );
}
