import { cn } from "@/shared/lib/utils";

/**
 * Saját rajzolású címer-jel (pajzs + érme), a brand színtokenjeivel. Nem utánoz egyetlen
 * játék-logót sem.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn("size-10 shrink-0 drop-shadow-[0_2px_6px_var(--glow)]", className)}
    >
      <path
        d="M24 3 42 9v14c0 11-7.5 18.5-18 22C13.5 41.5 6 34 6 23V9l18-6Z"
        fill="var(--surface-wood-dark)"
        stroke="var(--gold)"
        strokeWidth="2.5"
      />
      <path
        d="M24 8.5 37 13v10c0 8-5.3 13.6-13 16.4C16.3 36.6 11 31 11 23V13l13-4.5Z"
        fill="none"
        stroke="var(--bronze)"
        strokeWidth="1.2"
      />
      <circle cx="24" cy="23" r="8.5" fill="var(--gold)" />
      <circle cx="24" cy="23" r="6" fill="none" stroke="var(--gold-foreground)" strokeWidth="1.2" />
      <path
        d="m24 18.5 1.6 3.1 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5z"
        fill="var(--gold-foreground)"
      />
    </svg>
  );
}
