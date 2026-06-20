import { useMemo } from "react";
import { MetricChart } from "../../components/metric-chart";
import { Skeleton } from "../../components/skeleton";
import { useQueues } from "../../lib/use-queues";
import { cn, compact } from "../../lib/utils";

export function MetricsPage() {
  const { data: queues } = useQueues();

  const agg = useMemo(() => {
    const qs = queues ?? [];
    const rate = qs.reduce((a, q) => a + q.ratePerMin, 0);
    const completed = qs.reduce((a, q) => a + q.throughput.reduce((x, y) => x + y, 0), 0);
    const failed = qs.reduce((a, q) => a + q.failures.reduce((x, y) => x + y, 0), 0);
    const failRate = completed + failed === 0 ? 0 : failed / (completed + failed);

    return { rate, completed, failed, failRate };
  }, [queues]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Metrics</h1>
          <p className="mt-0.5 text-sm text-muted">Live throughput &amp; failures · last 60s</p>
        </div>
        <Legend />
      </header>

      {!queues ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-14.5 w-full rounded-lg" />
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3">
            <Stat label="Throughput" value={`${compact(agg.rate)}/m`} />
            <Stat label="Completed · 60s" value={compact(agg.completed)} />
            <Stat
              label="Failed · 60s"
              value={compact(agg.failed)}
              tone={agg.failed > 0 ? "failed" : undefined}
            />
            <Stat label="Fail rate" value={`${(agg.failRate * 100).toFixed(1)}%`} />
          </div>

          <div className="mt-6 space-y-3">
            {queues.map((q) => (
              <div key={q.name} className="rounded-lg border border-line bg-surface p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{q.name}</span>
                  <span className="text-xs tnum text-muted">
                    {compact(q.ratePerMin)}/m · {(q.failRate * 100).toFixed(1)}% fail
                  </span>
                </div>
                <MetricChart data={q.throughput} failures={q.failures} label={q.name} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "failed" }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("text-lg font-semibold tnum", tone === "failed" && "text-failed")}>
        {value}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-accent" /> throughput
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-failed" /> failures
      </span>
    </div>
  );
}
