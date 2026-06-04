import { type BulkAction, JOB_STATES, type Job, type JobState, queueHealth } from "@kew/core";
import { Link, useParams } from "@tanstack/react-router";
import type { RowSelectionState } from "@tanstack/react-table";
import { ArrowLeft, CheckCircle2, Pause, Play, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/skeleton";
import { StateDot } from "@/components/state-badge";
import { STATE_META } from "@/components/state-meta";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnection } from "@/lib/use-connection";
import { useQueue, useSetQueuePaused } from "@/lib/use-queues";
import { cn, compact } from "@/lib/utils";
import { BulkBar } from "./bulk-bar";
import { JobDrawer } from "./job-drawer";
import { JobTable } from "./job-table";
import { useBulkAction, useJobAction, useJobs, useRetryWithData } from "./use-jobs";

const TIME_WINDOWS = [
  { id: "all", label: "Any time", ms: Number.POSITIVE_INFINITY },
  { id: "1h", label: "1h", ms: 3_600_000 },
  { id: "24h", label: "24h", ms: 86_400_000 },
  { id: "7d", label: "7d", ms: 7 * 86_400_000 },
] as const;

type WindowId = (typeof TIME_WINDOWS)[number]["id"];

const ACTION_PAST: Record<BulkAction, string> = {
  retry: "re-queued",
  promote: "promoted",
  remove: "removed",
};

export function JobsPage() {
  const { queueName } = useParams({ from: "/queues/$queueName" });
  const { data: queue } = useQueue(queueName);
  const { data: conn } = useConnection();
  const readOnly = conn?.readOnly ?? false;

  const [state, setState] = useState<JobState>("failed");
  const [search, setSearch] = useState("");
  const [win, setWin] = useState<WindowId>("all");
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [openJob, setOpenJob] = useState<Job | null>(null);

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

  const bulk = useBulkAction(queueName);
  const jobAction = useJobAction(queueName);
  const retryWithData = useRetryWithData(queueName);
  const pauseQueue = useSetQueuePaused();

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
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            {queue && (
              <StateDot state={queueHealth(queue)} pulse={queueHealth(queue) === "active"} />
            )}
            <span className="font-mono">{queueName}</span>
            {queue?.paused && (
              <span className="inline-flex items-center gap-1 rounded bg-paused/15 px-1.5 py-0.5 text-[11px] font-normal text-paused">
                <Pause className="size-2.5" strokeWidth={2.5} />
                paused
              </span>
            )}
            {readOnly && (
              <span className="rounded bg-overlay px-1.5 py-0.5 text-[11px] font-normal text-delayed">
                read-only
              </span>
            )}
          </h1>
          {!readOnly && queue && (
            <Button
              variant="subtle"
              size="sm"
              disabled={pauseQueue.isPending}
              onClick={() => pauseQueue.mutate({ queue: queueName, paused: !queue.paused })}
            >
              {queue.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              {queue.paused ? "Resume" : "Pause"}
            </Button>
          )}
        </div>
      </div>

      <div
        role="tablist"
        className="mt-3 flex gap-1 overflow-x-auto border-b border-line px-4 md:px-8"
      >
        {JOB_STATES.map((s) => {
          const active = s === state;
          return (
            <button
              type="button"
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
              <span className={cn("text-xs tnum", active ? "text-ink-2" : "text-muted")}>
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
          aria-label="Search jobs by id, name, or payload"
          className="h-8 w-full max-w-xs rounded-md border border-line bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-line-strong"
        />
        <Select value={win} onValueChange={(v) => setWin(v as WindowId)}>
          <SelectTrigger size="sm" className="w-36">
            <SlidersHorizontal className="size-3 text-muted" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_WINDOWS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs tnum text-muted">{jobs.length} shown</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-8">
        {!page ? (
          <JobTableSkeleton />
        ) : jobs.length === 0 ? (
          <EmptyJobs state={state} filtered={Boolean(search) || win !== "all"} />
        ) : (
          <JobTable
            jobs={jobs}
            selection={selection}
            onSelectionChange={setSelection}
            onOpenJob={setOpenJob}
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
        onAction={(action) => {
          const n = Object.keys(selection).length;
          bulk.mutate(
            { ids: Object.keys(selection), action },
            {
              onSuccess: () => {
                toast.success(`${n} ${n === 1 ? "job" : "jobs"} ${ACTION_PAST[action]}`);
                setSelection({});
              },
            },
          );
        }}
        onClear={() => setSelection({})}
      />

      <JobDrawer
        job={openJob}
        readOnly={readOnly}
        pending={jobAction.isPending || retryWithData.isPending}
        onClose={() => setOpenJob(null)}
        onAction={(action, id) =>
          jobAction.mutate(
            { id, action },
            {
              onSuccess: () => {
                toast.success(`Job ${ACTION_PAST[action]}`);
                setOpenJob(null);
              },
            },
          )
        }
        onRetryWithData={(id, data) =>
          retryWithData.mutate(
            { id, data },
            {
              onSuccess: () => {
                toast.success("Job re-queued with the edited payload");
                setOpenJob(null);
              },
            },
          )
        }
      />
    </div>
  );
}

function JobTableSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line">
      <div className="h-9 shrink-0 border-b border-line bg-surface" />
      <div className="min-h-0 flex-1">
        {["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => (
          <div
            key={k}
            className="grid h-13 grid-cols-[34px_minmax(0,1fr)_auto_64px] items-center gap-3 border-b border-line/40 px-3 md:grid-cols-[34px_minmax(0,1fr)_132px_72px_64px_84px]"
          >
            <Skeleton className="size-3.5" />
            <Skeleton className="h-3.5 w-40 max-w-full" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="hidden h-3.5 w-8 md:block" />
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="hidden h-3.5 w-12 justify-self-end md:block" />
          </div>
        ))}
      </div>
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
