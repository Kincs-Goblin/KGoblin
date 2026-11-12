import { getBrandOrNotFound } from "@/shared/config/index.server";
import { Badge } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import { Reveal } from "@/shared/ui/motion";

import { homeTexts } from "../config/texts";

type HomePageProps = {
  params: Promise<{ brand: string }>;
};

export async function HomePage({ params }: HomePageProps) {
  const brand = getBrandOrNotFound((await params).brand);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Reveal
          fade={false}
          className="frame-gold surface-stone relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12 sm:py-20"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-2/3 rounded-full bg-glow opacity-40 blur-3xl"
          />
          <h1 className="text-engraved relative text-3xl font-bold text-balance sm:text-5xl">
            {brand.texts.heroTitle}
          </h1>
          <p className="relative mx-auto mt-4 max-w-2xl text-base text-pretty text-foreground/85 sm:text-lg">
            {brand.texts.heroSubtitle}
          </p>
          <a
            href="#ritkasag"
            className={buttonVariants({
              size: "lg",
              className: "relative mt-8 h-11 px-6 text-base",
            })}
          >
            {brand.texts.heroCta}
          </a>
        </Reveal>
      </section>

      <section id="ritkasag" className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-14 sm:px-6">
        <h2 className="text-engraved text-2xl font-bold sm:text-3xl">{homeTexts.rarityHeading}</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{homeTexts.rarityIntro}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {homeTexts.rarities.map((rarity, index) => (
            <li key={rarity.variant}>
              <Reveal delay={0.1 + index * 0.06} className="frame-gold h-full rounded-xl p-5">
                <Badge variant={rarity.variant}>{rarity.label}</Badge>
                <p className="mt-3 text-sm text-foreground/85">{rarity.description}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
