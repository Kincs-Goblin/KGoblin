"use client";

import { Button } from "@/shared/ui/button";

import { errorTexts } from "../config/texts";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Nyers hibaszöveget nem mutatunk; a `digest` a szerveroldali naplóhoz köt. */
export function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <section role="alert" className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-engraved text-2xl font-bold sm:text-3xl">{errorTexts.title}</h1>
      <p className="mt-3 text-muted-foreground">{errorTexts.description}</p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground/70">#{error.digest}</p>
      ) : null}
      <Button size="lg" className="mt-8 h-11 px-6" onClick={reset}>
        {errorTexts.retry}
      </Button>
    </section>
  );
}
