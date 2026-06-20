import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";
import { CalendarClock, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Scheduler } from "@/lib/api";
import { JsonView } from "../../components/json-view";
import { toast } from "../../components/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { useRemoveScheduler } from "./use-schedulers";

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
  const remove = useRemoveScheduler(queue);
  const [shown, setShown] = useState<Scheduler | null>(scheduler);

  useEffect(() => {
    if (scheduler) setShown(scheduler);
  }, [scheduler]);

  const s = scheduler ?? shown;
  const runs = useMemo(() => (s ? nextRuns(s) : []), [s]);

  return (
    <Sheet
      open={scheduler !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        {s && (
          <>
            <SheetHeader className="gap-1.5 border-b border-line p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-children" />
                <span className="font-mono text-xs text-muted">{s.id}</span>
              </div>
              <SheetTitle className="truncate font-mono text-base font-semibold">
                {s.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted">
                in <span className="font-mono">{queue}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <section>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
                  Schedule
                </h3>
                <p className="text-sm">{human(s)}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {s.pattern && <span className="font-mono">{s.pattern}</span>}
                  {s.every && <span className="font-mono">every {s.every}ms</span>}
                  {s.tz && <span>tz: {s.tz}</span>}
                </div>
              </section>

              <section>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
                  Creates job
                </h3>
                <div className="rounded-md border border-line bg-canvas p-3">
                  <div className="font-mono text-sm">{s.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    enqueued into <span className="font-mono">{queue}</span> on every run
                  </div>
                  {s.data != null && (
                    <div className="mt-2.5">
                      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">
                        with data
                      </div>
                      <JsonView value={s.data} />
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

            <div className="flex items-center justify-end border-t border-line p-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="danger">
                    <Trash2 className="size-3.5" />
                    Remove scheduler
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this scheduler?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <span className="font-mono">{s.name}</span> will stop enqueueing jobs into{" "}
                      <span className="font-mono">{queue}</span>. Jobs it already created are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="danger"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(s.id, {
                          onSuccess: () => {
                            toast.success("Scheduler removed");
                            onClose();
                          },
                        })
                      }
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
