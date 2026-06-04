import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact number: 1234 -> "1.2k", 1_500_000 -> "1.5M". */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim(n / 1000)}k`;
  return `${trim(n / 1_000_000)}M`;
}

function trim(n: number): string {
  return n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, "");
}

/** Relative time from a timestamp (ms): "12s", "4m", "3h", "2d". */
export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Human duration from ms: 850 -> "850ms", 4200 -> "4.2s", 92000 -> "1m32s". */
export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${trim(s)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${String(rem).padStart(2, "0")}s`;
}
