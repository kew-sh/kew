import type { Job } from "@kew/core";
import { ArrowUp, Pencil, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { JsonView } from "@/components/json-view";
import { StateBadge } from "@/components/state-badge";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { duration, relativeTime } from "@/lib/utils";

export function JobDrawer({
  job,
  readOnly,
  pending,
  onClose,
  onAction,
  onRetryWithData,
}: {
  job: Job | null;
  readOnly: boolean;
  pending: boolean;
  onClose: () => void;
  onAction: (action: "retry" | "promote" | "remove", id: string) => void;
  onRetryWithData: (id: string, data: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Job | null>(job);

  useEffect(() => {
    if (!job) return;
    setShown(job);
    setEditing(false);
    setError(null);
    setDraft(JSON.stringify(job.data, null, 2));
  }, [job]);

  const j = job ?? shown;

  const submitEdited = () => {
    if (!j) return;
    try {
      const parsed = JSON.parse(draft);
      setError(null);
      onRetryWithData(j.id, parsed);
    } catch {
      setError("Invalid JSON — fix the payload before retrying.");
    }
  };

  return (
    <Sheet
      open={job !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {j && (
          <>
            <SheetHeader className="gap-1.5 border-b border-line p-4">
              <div className="flex items-center gap-2">
                <StateBadge state={j.state} />
                <span className="font-mono text-xs text-muted">#{j.id}</span>
              </div>
              <SheetTitle className="truncate font-mono text-base font-semibold">
                {j.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted">
                in <span className="font-mono">{j.queue}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Meta label="Attempts" value={`${j.attemptsMade} / ${j.maxAttempts}`} />
                <Meta label="Priority" value={String(j.priority)} />
                <Meta label="Created" value={`${relativeTime(j.timestamp)} ago`} />
                <Meta
                  label="Duration"
                  value={j.durationMs != null ? duration(j.durationMs) : "—"}
                />
              </dl>

              {j.failedReason && (
                <Section title="Error">
                  <div className="rounded-md border border-failed/30 bg-failed/8 p-3">
                    <p className="font-mono text-xs text-failed">{j.failedReason}</p>
                    {j.stacktrace && j.stacktrace.length > 0 && (
                      <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-failed/70">
                        {j.stacktrace.join("\n")}
                      </pre>
                    )}
                  </div>
                </Section>
              )}

              <Section
                title="Payload"
                action={
                  !readOnly && !editing ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                  ) : null
                }
              >
                {editing ? (
                  <div className="space-y-2">
                    <textarea
                      value={draft}
                      spellCheck={false}
                      onChange={(e) => setDraft(e.target.value)}
                      className="h-52 w-full resize-y rounded-md border border-line-strong bg-canvas p-3 font-mono text-xs leading-relaxed text-ink outline-none focus:border-accent"
                    />
                    {error && <p className="text-xs text-failed">{error}</p>}
                    <p className="text-xs text-muted">
                      Editing re-enqueues this job with the new payload (BullMQ updateData + retry).
                    </p>
                  </div>
                ) : (
                  <JsonView value={j.data} />
                )}
              </Section>

              {j.returnValue != null && (
                <Section title="Return value">
                  <JsonView value={j.returnValue} />
                </Section>
              )}

              {j.logs && j.logs.length > 0 && (
                <Section title="Logs">
                  <div className="space-y-1 rounded-md border border-line bg-canvas p-3 font-mono text-[11px] text-ink-2">
                    {j.logs.map((line, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: append-only log lines, never reordered
                      <div key={i} className="whitespace-pre-wrap">
                        {line}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2 border-t border-line p-3">
                {editing ? (
                  <>
                    <Button variant="accent" disabled={pending} onClick={submitEdited}>
                      <RotateCw className="size-3.5" />
                      Retry with changes
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    {j.state === "failed" && (
                      <Button
                        variant="subtle"
                        disabled={pending}
                        onClick={() => onAction("retry", j.id)}
                      >
                        <RotateCw className="size-3.5" />
                        Retry
                      </Button>
                    )}
                    {j.state === "delayed" && (
                      <Button
                        variant="subtle"
                        disabled={pending}
                        onClick={() => onAction("promote", j.id)}
                      >
                        <ArrowUp className="size-3.5" />
                        Promote
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="danger" className="ml-auto" disabled={pending}>
                          <Trash2 className="size-3.5" />
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove this job?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes job #{j.id} from{" "}
                            <span className="font-mono">{j.queue}</span>. BullMQ can't restore a
                            removed job.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="danger"
                            onClick={() => onAction("remove", j.id)}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium tnum">{value}</dd>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
