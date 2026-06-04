import type { JobState } from "@kew/core";
import { cn } from "@/lib/utils";
import { STATE_META } from "./state-meta";

export function StateBadge({ state, className }: { state: JobState; className?: string }) {
  const m = STATE_META[state];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
        m.bg,
        m.text,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
      {m.label}
    </span>
  );
}

export function StateDot({
  state,
  pulse,
  className,
}: {
  state: JobState;
  pulse?: boolean;
  className?: string;
}) {
  const m = STATE_META[state];
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        m.dot,
        pulse && "pulse-dot",
        className,
      )}
      aria-hidden
    />
  );
}
