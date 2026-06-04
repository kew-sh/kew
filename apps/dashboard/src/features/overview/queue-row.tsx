import { Link } from "@tanstack/react-router";
import { ChevronRight, Pause } from "lucide-react";
import { queueHealth, type JobState, type QueueSummary } from "@queue-panel/core";
import { StateDot } from "@/components/state-badge";
import { Sparkline } from "@/components/sparkline";
import { cn, compact } from "@/lib/utils";

const STRIP: JobState[] = ["active", "waiting", "delayed", "failed", "completed"];

export function QueueRow({ q }: { q: QueueSummary }) {
  const health = queueHealth(q);
  return (
    <Link
      to="/queues/$queueName"
      params={{ queueName: q.name }}
      className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-overlay md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_112px_72px] md:gap-4"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <StateDot state={health} pulse={health === "active"} />
        <span className="truncate font-mono text-[13px] font-medium">{q.name}</span>
        {q.paused && (
          <span className="inline-flex items-center gap-1 rounded bg-paused/15 px-1.5 py-0.5 text-[11px] text-paused">
            <Pause className="size-2.5" strokeWidth={2.5} />
            paused
          </span>
        )}
      </div>

      <div className="hidden items-center gap-4 md:flex">
        {STRIP.map((s) => (
          <Count key={s} state={s} n={q.counts[s]} />
        ))}
      </div>

      <Sparkline data={q.throughput} failures={q.failures} className="hidden md:block" />

      <div className="hidden text-right text-sm tnum text-ink-2 md:block">
        {compact(q.ratePerMin)}
        <span className="text-muted">/m</span>
      </div>

      <div className="flex items-center gap-3 justify-self-end md:hidden">
        {q.counts.failed > 0 && <Count state="failed" n={q.counts.failed} />}
        <Count state="active" n={q.counts.active} />
        <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function Count({ state, n }: { state: JobState; n: number }) {
  const zero = n === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm tnum",
        zero ? "text-muted/40" : state === "failed" ? "text-failed" : "text-ink-2",
      )}
    >
      <StateDot state={state} className={zero ? "opacity-40" : undefined} />
      {compact(n)}
    </span>
  );
}
