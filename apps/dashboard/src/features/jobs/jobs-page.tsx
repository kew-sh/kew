import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import { ArrowLeft, CheckCircle2, SlidersHorizontal } from "lucide-react";
import {
  api,
  JOB_STATES,
  queueHealth,
  useConnection,
  useJobs,
  useQueue,
  type BulkAction,
  type JobState,
} from "@queue-panel/core";
import { StateDot } from "@/components/state-badge";
import { STATE_META } from "@/components/state-meta";
import { cn, compact } from "@/lib/utils";
import { JobTable } from "./job-table";
import { BulkBar } from "./bulk-bar";

const TIME_WINDOWS = [
  { id: "all", label: "Any time", ms: Number.POSITIVE_INFINITY },
  { id: "1h", label: "1h", ms: 3_600_000 },
  { id: "24h", label: "24h", ms: 86_400_000 },
  { id: "7d", label: "7d", ms: 7 * 86_400_000 },
] as const;

type WindowId = (typeof TIME_WINDOWS)[number]["id"];

export function JobsPage() {
  const { queueName } = useParams({ from: "/queues/$queueName" });
  const qc = useQueryClient();
  const { data: queue } = useQueue(queueName);
  const { data: conn } = useConnection();
  const readOnly = conn?.readOnly ?? false;

  const [state, setState] = useState<JobState>("failed");
  const [search, setSearch] = useState("");
  const [win, setWin] = useState<WindowId>("all");
  const [selection, setSelection] = useState<RowSelectionState>({});

  const { data: page } = useJobs({
    queue: queueName,
    state,
    page: 0,
    pageSize: 100,
    search: search || undefined,
  });

  const jobs = useMemo(() => {
    if (!page) return [];
    const ms = TIME_WINDOWS.find((t) => t.id === win)!.ms;
    if (!Number.isFinite(ms)) return page.jobs;
    const cutoff = Date.now() - ms;
    return page.jobs.filter((j) => j.timestamp >= cutoff);
  }, [page, win]);

  const bulk = useMutation({
    mutationFn: (action: BulkAction) =>
      api.bulkAction({ queue: queueName, ids: Object.keys(selection), action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs", queueName] });
      qc.invalidateQueries({ queryKey: ["queue", queueName] });
      setSelection({});
    },
  });

  const pickState = (s: JobState) => {
    setState(s);
    setSelection({});
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 md:px-8">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="size-3" />
          Queues
        </Link>
        <h1 className="mt-2 flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          {queue && (
            <StateDot state={queueHealth(queue)} pulse={queueHealth(queue) === "active"} />
          )}
          <span className="font-mono">{queueName}</span>
          {readOnly && (
            <span className="rounded bg-overlay px-1.5 py-0.5 text-[11px] font-normal text-delayed">
              read-only
            </span>
          )}
        </h1>
      </div>

      <div role="tablist" className="mt-3 flex gap-1 overflow-x-auto border-b border-line px-4 md:px-8">
        {JOB_STATES.map((s) => {
          const active = s === state;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={active}
              onClick={() => pickState(s)}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm transition-colors",
                active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              <StateDot state={s} />
              {STATE_META[s].label}
              <span className={cn("text-xs tnum", active ? "text-ink-2" : "text-muted/60")}>
                {compact(queue?.counts[s] ?? 0)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-8">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search id, name, payload…"
          className="h-8 w-full max-w-xs rounded-md border border-line bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-line-strong"
        />
        <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 text-xs">
          <SlidersHorizontal className="ml-1 size-3 text-muted" />
          {TIME_WINDOWS.map((t) => (
            <button
              key={t.id}
              onClick={() => setWin(t.id)}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                win === t.id ? "bg-overlay text-ink" : "text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs tnum text-muted">{jobs.length} shown</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-8">
        {page && jobs.length === 0 ? (
          <EmptyJobs state={state} filtered={Boolean(search) || win !== "all"} />
        ) : (
          <JobTable
            jobs={jobs}
            selection={selection}
            onSelectionChange={setSelection}
            readOnly={readOnly}
          />
        )}
        {search && page && !page.exact && (
          <p className="mt-2 text-xs text-muted">
            Matches from a bounded scan of recent jobs. The real backend caps the scan window, so
            narrow by name or time to reach older jobs.
          </p>
        )}
      </div>

      <BulkBar
        count={Object.keys(selection).length}
        pending={bulk.isPending}
        onAction={(a) => bulk.mutate(a)}
        onClear={() => setSelection({})}
      />
    </div>
  );
}

function EmptyJobs({ state, filtered }: { state: JobState; filtered: boolean }) {
  if (filtered) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
        <p className="text-sm text-ink-2">No jobs match your filters.</p>
        <p className="mt-1 text-xs text-muted">Clear the search or widen the time range.</p>
      </div>
    );
  }
  const good = state === "failed";
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
      {good ? (
        <CheckCircle2 className="size-7 text-completed" />
      ) : (
        <StateDot state={state} className="size-3" />
      )}
      <p className="mt-3 text-sm text-ink-2">No {STATE_META[state].label.toLowerCase()} jobs.</p>
    </div>
  );
}
