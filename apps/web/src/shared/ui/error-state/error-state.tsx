import { TriangleAlertIcon } from "lucide-react";

import { errorCatalog, type ErrorCode } from "@/shared/lib/errors";

/** Emberi hibaüzenet a katalógusból; nyers backend-szöveget vagy stack trace-t nem mutat. */
export function ErrorState({ code, title }: { code: ErrorCode; title: string }) {
  return (
    <div role="alert" className="frame-gold mx-auto max-w-xl rounded-xl p-8 text-center">
      <TriangleAlertIcon aria-hidden="true" className="mx-auto size-10 text-gold" />
      <h2 className="mt-4 font-heading text-xl text-gold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{errorCatalog[code].message}</p>
      <p className="mt-3 font-mono text-xs text-muted-foreground/70">{code}</p>
    </div>
  );
}
