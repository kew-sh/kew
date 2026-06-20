import { cn } from "../lib/utils";

export function KewMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      className={cn("text-accent", className)}
      role="img"
      aria-label="Kew"
    >
      <g
        stroke="currentColor"
        strokeWidth={11}
        strokeLinejoin="miter"
        strokeLinecap="butt"
        strokeMiterlimit={8}
      >
        <polyline points="26,26 42,48 26,70" opacity={0.4} />
        <polyline points="40,26 56,48 40,70" opacity={0.7} />
        <polyline points="54,26 70,48 54,70" opacity={1} />
      </g>
    </svg>
  );
}
