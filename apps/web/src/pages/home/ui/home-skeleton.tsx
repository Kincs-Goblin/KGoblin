import { Skeleton } from "@/shared/ui/skeleton";

export function HomeSectionsSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Kiemelt termékek betöltése"
      className="mx-auto max-w-7xl px-4 pt-14 sm:px-6"
    >
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="frame-gold flex flex-col gap-3 rounded-xl p-3 sm:p-4">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  );
}
