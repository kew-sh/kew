import { backlog, type QueueSummary, useQueues } from "@kew/core";
import { Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { QueueRow } from "./queue-row";

type Sort = "health" | "backlog" | "name";

export function OverviewPage() {
  const { data: queues, isLoading } = useQueues();
  const [sort, setSort] = useState<Sort>("health");

  const sorted = useMemo(() => {
    if (!queues) return [];
    const arr = [...queues];
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "backlog") arr.sort((a, b) => backlog(b) - backlog(a));
    else arr.sort((a, b) => severity(b) - severity(a));
    return arr;
  }, [queues, sort]);

  return (
    <div className="mx-auto max-w-270 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Queues</h1>
          <p className="mt-0.5 text-sm text-muted">
            {queues ? `${queues.length} queues` : "Loading…"}
            <span className="text-muted/60"> · updating live</span>
          </p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 text-sm">
          {(["health", "backlog", "name"] as Sort[]).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setSort(s)}
              className={cn(
                "rounded-md px-2.5 py-1 capitalize transition-colors",
                sort === s ? "bg-overlay text-ink" : "text-muted hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-5">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_112px_72px] gap-4 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted md:grid">
          <span>Queue</span>
          <span>States</span>
          <span>30-min throughput</span>
          <span className="text-right">Rate</span>
        </div>

        <div className="space-y-1.5">
          {isLoading && !queues
            ? ["a", "b", "c", "d", "e"].map((k) => <RowSkeleton key={k} />)
            : sorted.map((q) => <QueueRow key={q.name} q={q} />)}
        </div>

        {queues?.length === 0 && <EmptyQueues />}
      </div>
    </div>
  );
}

/** Rank failing/backed-up queues to the top under the default "health" sort. */
function severity(q: QueueSummary) {
  return q.counts.failed * 2 + q.failRate * 600 + backlog(q) * 0.02;
}

function RowSkeleton() {
  return (
    <div className="flex h-[58px] items-center gap-3 rounded-lg border border-line bg-surface px-3">
      <div className="size-2 rounded-full bg-line-strong" />
      <div className="h-3.5 w-32 rounded bg-line-strong/70" />
      <div className="ml-auto h-3 w-40 rounded bg-line-strong/40" />
    </div>
  );
}

function EmptyQueues() {
  return (
    <div className="mt-2 flex flex-col items-center rounded-lg border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
      <Inbox className="size-7 text-muted" />
      <h2 className="mt-3 text-sm font-medium text-ink">No queues found on this Redis</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        BullMQ queues appear here once a producer adds a job or a worker starts. Check that the
        panel points at the same Redis as your app.
      </p>
    </div>
  );
}
