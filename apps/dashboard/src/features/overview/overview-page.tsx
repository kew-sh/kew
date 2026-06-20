import { Inbox, Unplug } from "lucide-react";
import { useMemo, useState } from "react";
import type { QueueSummary } from "@/lib/api";
import { backlog } from "@/lib/queue-health";
import { useConnection } from "../../lib/use-connection";
import { useQueues } from "../../lib/use-queues";
import { cn } from "../../lib/utils";
import { QueueRow } from "./queue-row";

type Sort = "health" | "backlog" | "name";

const SORTS: { id: Sort; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "backlog", label: "Backlog" },
  { id: "name", label: "Name" },
];

export function OverviewPage() {
  const { data: queues } = useQueues();
  const { data: conn } = useConnection();
  const [sort, setSort] = useState<Sort>("health");
  const disconnected = conn?.status === "error";

  const nameKey = JSON.stringify((queues ?? []).map((q) => q.name));
  // biome-ignore lint/correctness/useExhaustiveDependencies: the order is intentionally frozen against live metric updates — it re-sorts only when the sort mode or the set of queues changes, so rows stay put while their numbers update underneath.
  const order = useMemo(() => {
    if (!queues) return [];

    const arr = [...queues];
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "backlog") arr.sort((a, b) => backlog(b) - backlog(a));
    else arr.sort((a, b) => severity(b) - severity(a));

    return arr.map((q) => q.name);
  }, [sort, nameKey]);

  const sorted = useMemo(() => {
    const byName = new Map((queues ?? []).map((q) => [q.name, q] as const));

    return order.map((n) => byName.get(n)).filter((q): q is QueueSummary => Boolean(q));
  }, [order, queues]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Queues</h1>
          <p className="mt-0.5 text-sm text-muted">
            {disconnected ? "Disconnected" : queues ? `${queues.length} queues` : "Connecting…"}
            {!disconnected && <span className="text-muted"> · updating live</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Sort</span>
          <div className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={sort === s.id}
                onClick={() => setSort(s.id)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs transition-colors",
                  sort === s.id ? "bg-overlay font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-5">
        {disconnected ? (
          <DisconnectedQueues url={conn?.url} />
        ) : !queues ? (
          <div className="space-y-1.5">
            {["a", "b", "c", "d", "e"].map((k) => (
              <RowSkeleton key={k} />
            ))}
          </div>
        ) : queues.length === 0 ? (
          <EmptyQueues url={conn?.url} />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_112px_72px] gap-4 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted md:grid">
              <span>Queue</span>
              <span>States</span>
              <span>throughput · 60s</span>
              <span className="text-right">Rate</span>
            </div>
            <div className="space-y-1.5">
              {sorted.map((q) => (
                <QueueRow key={q.name} q={q} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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

function EmptyQueues({ url }: { url?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
      <Inbox className="size-7 text-muted" />
      <h2 className="mt-3 text-sm font-medium text-ink">No queues found on this Redis</h2>
      <p className="mt-1 max-w-md text-sm text-muted">
        Connected to <span className="font-mono text-ink-2">{url ?? "Redis"}</span>, but no BullMQ
        queues are registered yet. They appear once a producer adds a job or a worker starts. If you
        expected some, check the <span className="font-mono text-ink-2">BULLMQ_PREFIX</span>.
      </p>
    </div>
  );
}

function DisconnectedQueues({ url }: { url?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-failed/40 bg-failed/5 px-6 py-16 text-center">
      <Unplug className="size-7 text-failed" />
      <h2 className="mt-3 text-sm font-medium text-ink">Can’t reach Redis</h2>
      <p className="mt-1 max-w-md text-sm text-muted">
        The dashboard is running, but it can’t connect to{" "}
        <span className="font-mono text-ink-2">{url ?? "Redis"}</span>. Check that Redis is up and
        the URL is correct. Retrying automatically…
      </p>
    </div>
  );
}
