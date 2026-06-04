import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import {
  JOB_STATES,
  queueHealth,
  useJobs,
  useQueue,
  type JobState,
} from "@queue-panel/core";
import { StateBadge, StateDot } from "@/components/state-badge";
import { STATE_META } from "@/components/state-meta";
import { cn, compact, duration, relativeTime } from "@/lib/utils";

export function JobsPage() {
  const { queueName } = useParams({ from: "/queues/$queueName" });
  const { data: queue } = useQueue(queueName);
  const [state, setState] = useState<JobState>("failed");
  const [search, setSearch] = useState("");
  const { data: page } = useJobs({
    queue: queueName,
    state,
    page: 0,
    pageSize: 50,
    search: search || undefined,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 md:px-8">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="size-3" />
          Queues
        </Link>
        <h1 className="mt-2 flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          {queue && <StateDot state={queueHealth(queue)} pulse={queueHealth(queue) === "active"} />}
          <span className="font-mono">{queueName}</span>
        </h1>
      </div>

      {/* state tabs (roving via native buttons) */}
      <div
        role="tablist"
        className="mt-3 flex gap-1 overflow-x-auto border-b border-line px-4 md:px-8"
      >
        {JOB_STATES.map((s) => {
          const active = s === state;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={active}
              onClick={() => setState(s)}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm transition-colors",
                active
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink",
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

      <div className="px-4 pt-3 md:px-8">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search id, name, payload…"
          className="h-8 w-full max-w-sm rounded-md border border-line bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-line-strong"
        />
        {search && page && !page.exact && (
          <p className="mt-1.5 text-xs text-muted">
            Matches from a bounded scan of recent jobs. Narrow by date to reach older ones.
          </p>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-10 md:px-8">
        {page && page.jobs.length === 0 ? (
          <EmptyJobs state={state} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="w-32 px-3 py-2 font-medium">State</th>
                  <th className="w-24 px-3 py-2 font-medium">Attempts</th>
                  <th className="w-20 px-3 py-2 font-medium">Age</th>
                  <th className="w-24 px-3 py-2 text-right font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {page?.jobs.map((j) => (
                  <tr
                    key={j.id}
                    className="border-t border-line/60 transition-colors hover:bg-surface"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted">#{j.id}</span>
                        <span className="font-medium">{j.name}</span>
                      </div>
                      {j.failedReason && (
                        <div className="mt-0.5 truncate font-mono text-xs text-failed/90">
                          {j.failedReason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StateBadge state={j.state} />
                    </td>
                    <td className="px-3 py-2 tnum text-ink-2">
                      {j.attemptsMade}
                      <span className="text-muted">/{j.maxAttempts}</span>
                    </td>
                    <td className="px-3 py-2 tnum text-ink-2">{relativeTime(j.timestamp)}</td>
                    <td className="px-3 py-2 text-right tnum text-ink-2">
                      {j.durationMs != null ? duration(j.durationMs) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyJobs({ state }: { state: JobState }) {
  const label = STATE_META[state].label.toLowerCase();
  const good = state === "failed";
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
      {good ? (
        <CheckCircle2 className="size-7 text-completed" />
      ) : (
        <StateDot state={state} className="size-3" />
      )}
      <p className="mt-3 text-sm text-ink-2">No {label} jobs.</p>
    </div>
  );
}
