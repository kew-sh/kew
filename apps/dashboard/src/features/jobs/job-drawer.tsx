import { useEffect, useState } from "react";
import { ArrowUp, Pencil, RotateCw, Trash2, X } from "lucide-react";
import type { Job } from "@kew/core";
import { StateBadge } from "@/components/state-badge";
import { Button } from "@/components/ui/button";
import { JsonView } from "@/components/json-view";
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
  const [confirmRemove, setConfirmRemove] = useState(false);

  // reset local state whenever a different job opens
  useEffect(() => {
    if (!job) return;
    setEditing(false);
    setConfirmRemove(false);
    setError(null);
    setDraft(JSON.stringify(job.data, null, 2));
  }, [job?.id]);

  useEffect(() => {
    if (!job) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  if (!job) return null;

  const submitEdited = () => {
    try {
      const parsed = JSON.parse(draft);
      setError(null);
      onRetryWithData(job.id, parsed);
    } catch {
      setError("Invalid JSON — fix the payload before retrying.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label={`Job ${job.id}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-line-strong bg-overlay shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StateBadge state={job.state} />
              <span className="font-mono text-xs text-muted">#{job.id}</span>
            </div>
            <h2 className="mt-1.5 truncate font-mono text-base font-semibold">{job.name}</h2>
            <p className="text-xs text-muted">
              in <span className="font-mono">{job.queue}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Meta label="Attempts" value={`${job.attemptsMade} / ${job.maxAttempts}`} />
            <Meta label="Priority" value={String(job.priority)} />
            <Meta label="Created" value={`${relativeTime(job.timestamp)} ago`} />
            <Meta label="Duration" value={job.durationMs != null ? duration(job.durationMs) : "—"} />
          </dl>

          {job.failedReason && (
            <Section title="Error">
              <div className="rounded-md border border-failed/30 bg-failed/8 p-3">
                <p className="font-mono text-xs text-failed">{job.failedReason}</p>
                {job.stacktrace && job.stacktrace.length > 0 && (
                  <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-failed/70">
                    {job.stacktrace.join("\n")}
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
              <JsonView value={job.data} />
            )}
          </Section>

          {job.returnValue != null && (
            <Section title="Return value">
              <JsonView value={job.returnValue} />
            </Section>
          )}

          {job.logs && job.logs.length > 0 && (
            <Section title="Logs">
              <div className="space-y-1 rounded-md border border-line bg-canvas p-3 font-mono text-[11px] text-ink-2">
                {job.logs.map((line, i) => (
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
            ) : confirmRemove ? (
              <>
                <span className="text-sm text-muted">Remove this job?</span>
                <Button
                  variant="danger"
                  className="ml-auto"
                  disabled={pending}
                  onClick={() => onAction("remove", job.id)}
                >
                  Confirm remove
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {job.state === "failed" && (
                  <Button variant="subtle" disabled={pending} onClick={() => onAction("retry", job.id)}>
                    <RotateCw className="size-3.5" />
                    Retry
                  </Button>
                )}
                {job.state === "delayed" && (
                  <Button variant="subtle" disabled={pending} onClick={() => onAction("promote", job.id)}>
                    <ArrowUp className="size-3.5" />
                    Promote
                  </Button>
                )}
                <Button
                  variant="danger"
                  className="ml-auto"
                  disabled={pending}
                  onClick={() => setConfirmRemove(true)}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
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
