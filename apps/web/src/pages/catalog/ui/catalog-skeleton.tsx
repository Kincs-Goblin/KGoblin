import { Skeleton } from "@/shared/ui/skeleton";

export function CatalogPageSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Katalógus betöltése"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-3 h-9 w-64 sm:h-10" />
      <Skeleton className="mt-2 h-5 w-full max-w-xl" />

      <div className="surface-wood mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bronze/40 p-4">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
        <Skeleton className="h-8 w-44 rounded-lg" />
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
        <div className="hidden flex-col gap-4 lg:flex">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div>
          <Skeleton className="mb-4 h-4 w-24" />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="frame-gold flex flex-col gap-3 rounded-xl p-3 sm:p-4">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="mt-2 h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
