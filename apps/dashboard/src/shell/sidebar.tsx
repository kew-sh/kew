import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  GitFork,
  Layers,
  ListChecks,
} from "lucide-react";
import {
  queueHealth,
  useConnection,
  useQueues,
  type QueueSummary,
} from "@kew/core";
import { StateDot } from "@/components/state-badge";
import { cn, compact } from "@/lib/utils";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: queues } = useQueues();
  const { data: conn } = useConnection();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={cn(
          "z-40 flex w-60 shrink-0 flex-col border-r border-line bg-surface",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-2xl max-md:transition-transform max-md:duration-200 max-md:ease-[var(--ease-out-quart)]",
          open ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        )}
      >
        {/* brand mark — Layers glyph is a placeholder for the real Kew logo */}
        <div className="flex h-14 items-center gap-2.5 px-4">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-ink">
            <Layers className="size-4" strokeWidth={2.5} />
          </span>
          <span className="font-semibold tracking-tight">Kew</span>
          <span className="rounded bg-overlay px-1 py-0.5 font-mono text-[10px] text-muted">beta</span>
        </div>

        <nav className="space-y-0.5 px-2 pt-1">
          <Link
            to="/"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
              pathname === "/"
                ? "bg-overlay font-medium text-ink"
                : "text-ink-2 hover:bg-overlay/60 hover:text-ink",
            )}
          >
            <ListChecks className={cn("size-4", pathname === "/" ? "text-accent" : "text-muted")} />
            Overview
          </Link>
          <Link
            to="/schedulers"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
              pathname === "/schedulers"
                ? "bg-overlay font-medium text-ink"
                : "text-ink-2 hover:bg-overlay/60 hover:text-ink",
            )}
          >
            <CalendarClock
              className={cn("size-4", pathname === "/schedulers" ? "text-accent" : "text-muted")}
            />
            Schedulers
          </Link>
          <Link
            to="/flows"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
              pathname === "/flows"
                ? "bg-overlay font-medium text-ink"
                : "text-ink-2 hover:bg-overlay/60 hover:text-ink",
            )}
          >
            <GitFork className={cn("size-4", pathname === "/flows" ? "text-accent" : "text-muted")} />
            Flows
          </Link>
          <Link
            to="/metrics"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
              pathname === "/metrics"
                ? "bg-overlay font-medium text-ink"
                : "text-ink-2 hover:bg-overlay/60 hover:text-ink",
            )}
          >
            <BarChart3 className={cn("size-4", pathname === "/metrics" ? "text-accent" : "text-muted")} />
            Metrics
          </Link>
        </nav>

        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <div className="px-4 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
            Queues
          </div>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2">
            {queues?.map((q) => (
              <QueueLink
                key={q.name}
                q={q}
                active={pathname === `/queues/${q.name}`}
                onNavigate={onClose}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2 text-xs">
            <StateDot
              state={conn?.status === "connected" ? "completed" : "failed"}
              pulse={conn?.status === "connected"}
            />
            <span className="min-w-0 flex-1 truncate font-mono text-muted">
              {conn?.url ?? "connecting…"}
            </span>
            {conn && <span className="font-mono text-[10px] text-muted/70">v{conn.redisVersion}</span>}
          </div>
        </div>
      </aside>
    </>
  );
}

function QueueLink({
  q,
  active,
  onNavigate,
}: {
  q: QueueSummary;
  active: boolean;
  onNavigate: () => void;
}) {
  const health = queueHealth(q);
  return (
    <Link
      to="/queues/$queueName"
      params={{ queueName: q.name }}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5",
        active ? "bg-overlay text-ink" : "text-ink-2 hover:bg-overlay/60 hover:text-ink",
      )}
    >
      <StateDot state={health} pulse={health === "active"} />
      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{q.name}</span>
      {q.counts.failed > 0 && (
        <span className="tnum text-xs text-failed">{compact(q.counts.failed)}</span>
      )}
    </Link>
  );
}
