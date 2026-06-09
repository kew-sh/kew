import type { HistoryQuery, Job } from "@kew/core";
import type { RowSelectionState } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Clock, History, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "../../components/skeleton";
import { StateDot } from "../../components/state-badge";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useQueues } from "../../lib/use-queues";
import { cn, compact } from "../../lib/utils";
import { JobDrawer } from "../jobs/job-drawer";
import { JobTable } from "../jobs/job-table";
import { useHistory } from "./use-history";

const TIME_WINDOWS = [
  { id: "all", label: "Any time", ms: Number.POSITIVE_INFINITY },
  { id: "1h", label: "1h", ms: 3_600_000 },
  { id: "24h", label: "24h", ms: 86_400_000 },
  { id: "7d", label: "7d", ms: 7 * 86_400_000 },
] as const;

type WindowId = (typeof TIME_WINDOWS)[number]["id"];

const STATE_TABS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
] as const;

type StateTab = (typeof STATE_TABS)[number]["id"];

const PAGE_SIZE = 50;
const ALL_QUEUES = "__all__";
const EMPTY_SELECTION: RowSelectionState = {};
const noop = () => {};

export function HistoryPage() {
  const { data: queues } = useQueues();

  const [queue, setQueue] = useState("");
  const [stateTab, setStateTab] = useState<StateTab>("all");
  const [win, setWin] = useState<WindowId>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [openJob, setOpenJob] = useState<Job | null>(null);

  const winMs = TIME_WINDOWS.find((t) => t.id === win)!.ms;
  const from = Number.isFinite(winMs)
    ? Math.floor((Date.now() - winMs) / 60_000) * 60_000
    : undefined;

  const query: HistoryQuery = {
    queue: queue || undefined,
    state: stateTab === "all" ? undefined : stateTab,
    from,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data } = useHistory(query);

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;
  const filtered = Boolean(queue || search || stateTab !== "all" || win !== "all");

  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(0);
    };

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <div className="px-4 pt-4 md:px-8">
        <h1 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <History className="size-5 text-accent" />
          History
        </h1>
        <p className="mt-1 text-xs text-muted">
          Completed and failed jobs Kew has observed, kept even when removeOnComplete clears them
          from Redis.
        </p>
      </div>

      <div
        role="tablist"
        className="mt-3 flex gap-1 overflow-x-auto border-b border-line px-4 md:px-8"
      >
        {STATE_TABS.map((t) => {
          const active = t.id === stateTab;
          return (
            <button
              type="button"
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => reset(setStateTab)(t.id)}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm transition-colors",
                active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.id !== "all" && <StateDot state={t.id} />}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-8">
        <input
          value={search}
          onChange={(e) => reset(setSearch)(e.target.value)}
          placeholder="Search id, name, payload…"
          aria-label="Search history by id, name, or payload"
          className="h-8 w-full max-w-xs rounded-md border border-line bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-line-strong"
        />
        <Select
          value={queue || ALL_QUEUES}
          onValueChange={(v) => reset(setQueue)(v === ALL_QUEUES ? "" : v)}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_QUEUES}>All queues</SelectItem>
            {queues?.map((q) => (
              <SelectItem key={q.name} value={q.name}>
                {q.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={win} onValueChange={(v) => reset(setWin)(v as WindowId)}>
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
        <span className="ml-auto text-xs tnum text-muted">{compact(total)} total</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-8">
        {!data ? (
          <HistorySkeleton />
        ) : jobs.length === 0 ? (
          <EmptyHistory filtered={filtered} />
        ) : (
          <JobTable
            jobs={jobs}
            selection={EMPTY_SELECTION}
            onSelectionChange={noop}
            onOpenJob={setOpenJob}
            readOnly
            rowId={(j) => `${j.queue}:${j.id}`}
          />
        )}

        {(page > 0 || hasNext) && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span className="tnum">
              {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + jobs.length} of {compact(total)}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="subtle"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-3.5" />
                Prev
              </Button>
              <Button
                variant="subtle"
                size="sm"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <JobDrawer
        job={openJob}
        readOnly
        pending={false}
        onClose={() => setOpenJob(null)}
        onAction={noop}
        onRetryWithData={noop}
        onRerun={noop}
      />
    </div>
  );
}

function HistorySkeleton() {
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

function EmptyHistory({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
      <Clock className="size-7 text-muted" />
      {filtered ? (
        <>
          <p className="mt-3 text-sm text-ink-2">No history matches your filters.</p>
          <p className="mt-1 text-xs text-muted">Clear the search or widen the time range.</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-ink-2">No history yet.</p>
          <p className="mt-1 text-xs text-muted">
            Kew records completed and failed jobs as they happen. New runs will show up here.
          </p>
        </>
      )}
    </div>
  );
}
