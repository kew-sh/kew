import { api, type Scheduler } from "@kew/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";
import { CalendarClock, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { JsonView } from "@/components/json-view";
import { Button } from "@/components/ui/button";

function human(s: Scheduler): string {
  if (s.pattern) {
    try {
      return cronstrue.toString(s.pattern, { verbose: true });
    } catch {
      return s.pattern;
    }
  }
  if (s.every) {
    const sec = Math.round(s.every / 1000);
    if (sec % 3600 === 0) return `Every ${sec / 3600} hour(s)`;
    if (sec % 60 === 0) return `Every ${sec / 60} minute(s)`;
    return `Every ${sec} seconds`;
  }
  return "—";
}

function nextRuns(s: Scheduler, count = 6): Date[] {
  if (s.every) {
    const base = s.next ?? Date.now() + s.every;
    return Array.from({ length: count }, (_, i) => new Date(base + i * s.every!));
  }
  if (s.pattern) {
    try {
      const it = CronExpressionParser.parse(s.pattern, {
        tz: s.tz,
        currentDate: new Date(),
      });
      return Array.from({ length: count }, () => it.next().toDate());
    } catch {
      return [];
    }
  }
  return [];
}

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function SchedulerDrawer({
  queue,
  scheduler,
  onClose,
}: {
  queue: string;
  scheduler: Scheduler | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (scheduler) setConfirm(false);
  }, [scheduler?.id, scheduler]);

  useEffect(() => {
    if (!scheduler) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scheduler, onClose]);

  const remove = useMutation({
    mutationFn: () => api.removeScheduler({ queue, id: scheduler!.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedulers", queue] });
      onClose();
    },
  });

  const runs = useMemo(() => (scheduler ? nextRuns(scheduler) : []), [scheduler]);

  if (!scheduler) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={`Scheduler ${scheduler.id}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-line-strong bg-overlay shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-children" />
              <span className="font-mono text-xs text-muted">{scheduler.id}</span>
            </div>
            <h2 className="mt-1.5 truncate font-mono text-base font-semibold">{scheduler.name}</h2>
            <p className="text-xs text-muted">
              in <span className="font-mono">{queue}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <section>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              Schedule
            </h3>
            <p className="text-sm">{human(scheduler)}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {scheduler.pattern && <span className="font-mono">{scheduler.pattern}</span>}
              {scheduler.every && <span className="font-mono">every {scheduler.every}ms</span>}
              {scheduler.tz && <span>tz: {scheduler.tz}</span>}
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              Creates job
            </h3>
            <div className="rounded-md border border-line bg-canvas p-3">
              <div className="font-mono text-sm">{scheduler.name}</div>
              <div className="mt-0.5 text-xs text-muted">
                enqueued into <span className="font-mono">{queue}</span> on every run
              </div>
              {scheduler.data != null && (
                <div className="mt-2.5">
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">
                    with data
                  </div>
                  <JsonView value={scheduler.data} />
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              Next runs
            </h3>
            {runs.length === 0 ? (
              <p className="text-sm text-muted">
                Couldn't compute upcoming runs from this pattern.
              </p>
            ) : (
              <ol className="overflow-hidden rounded-md border border-line">
                {runs.map((d, i) => (
                  <li
                    key={d.getTime()}
                    className="flex items-center justify-between border-b border-line/50 px-3 py-2 text-sm last:border-0"
                  >
                    <span className="tnum">{fmt.format(d)}</span>
                    <span className="text-xs text-muted">{i === 0 ? "next" : `+${i}`}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="flex items-center gap-2 border-t border-line p-3">
          {confirm ? (
            <>
              <span className="text-sm text-muted">Remove this scheduler?</span>
              <Button
                variant="danger"
                className="ml-auto"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Confirm remove
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" className="ml-auto" onClick={() => setConfirm(true)}>
              <Trash2 className="size-3.5" />
              Remove scheduler
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
