import type { Scheduler } from "@kew/core";
import cronstrue from "cronstrue";
import { CalendarClock, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/skeleton";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { useQueues } from "@/lib/use-queues";
import { cn } from "@/lib/utils";
import { SchedulerDrawer } from "./scheduler-drawer";
import { useRemoveScheduler, useSchedulers, useUpsertScheduler } from "./use-schedulers";

function humanSchedule(s: Scheduler): string {
  if (s.pattern) {
    try {
      return cronstrue.toString(s.pattern, { verbose: false });
    } catch {
      return s.pattern;
    }
  }
  if (s.every) {
    const sec = Math.round(s.every / 1000);
    if (sec % 3600 === 0) return `Every ${sec / 3600}h`;
    if (sec % 60 === 0) return `Every ${sec / 60}m`;
    return `Every ${sec}s`;
  }
  return "—";
}

function until(ts: number): string {
  const s = Math.max(0, Math.round((ts - Date.now()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function SchedulersPage() {
  const { data: queues } = useQueues();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<{ queue: string; scheduler: Scheduler } | null>(null);

  return (
    <div className="mx-auto max-w-270 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Schedulers</h1>
          <p className="mt-0.5 text-sm text-muted">Cron &amp; repeatable jobs across your queues</p>
        </div>
        <Button variant={creating ? "ghost" : "accent"} onClick={() => setCreating((v) => !v)}>
          {creating ? <X className="size-4" /> : <Plus className="size-4" />}
          {creating ? "Cancel" : "New schedule"}
        </Button>
      </header>

      {creating && (
        <CreateForm queues={queues?.map((q) => q.name) ?? []} onDone={() => setCreating(false)} />
      )}

      <div className="mt-6 space-y-6">
        {!queues
          ? ["a", "b"].map((k) => (
              <div key={k}>
                <Skeleton className="mb-2 h-3.5 w-28" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ))
          : queues.map((q) => (
              <QueueSchedulers
                key={q.name}
                queue={q.name}
                onOpen={(scheduler) => setOpen({ queue: q.name, scheduler })}
              />
            ))}
      </div>

      <SchedulerDrawer
        queue={open?.queue ?? ""}
        scheduler={open?.scheduler ?? null}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function QueueSchedulers({
  queue,
  onOpen,
}: {
  queue: string;
  onOpen: (scheduler: Scheduler) => void;
}) {
  const { data: schedulers } = useSchedulers(queue);
  const remove = useRemoveScheduler(queue);

  if (!schedulers || schedulers.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 font-mono text-sm text-muted">{queue}</h2>
      <div className="overflow-hidden rounded-lg border border-line">
        {schedulers.map((s) => (
          // biome-ignore lint/a11y/useSemanticElements: row wraps a remove button, which a <button> can't legally contain
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            aria-label={`Open scheduler ${s.name}`}
            onClick={() => onOpen(s)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onOpen(s);
              }
            }}
            className="group flex cursor-pointer items-center gap-3 border-b border-line/50 px-3 py-2.5 last:border-0 hover:bg-surface"
          >
            <CalendarClock className="size-4 shrink-0 text-children" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{s.name}</span>
                <span className="font-mono text-xs text-muted">{s.id}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {humanSchedule(s)}
                {s.pattern && <span className="ml-2 font-mono text-muted">{s.pattern}</span>}
                {s.tz && <span className="ml-2">· {s.tz}</span>}
              </div>
            </div>
            {s.next && (
              <div className="text-right text-xs tnum text-ink-2">next in {until(s.next)}</div>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100"
              disabled={remove.isPending}
              onClick={(e) => {
                e.stopPropagation();
                remove.mutate(s.id, { onSuccess: () => toast.success("Scheduler removed") });
              }}
              aria-label={`Remove scheduler ${s.id}`}
            >
              <Trash2 className="size-3.5 text-failed" />
            </Button>
            <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateForm({ queues, onDone }: { queues: string[]; onDone: () => void }) {
  const [queue, setQueue] = useState(queues[0] ?? "");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState("0 9 * * *");
  const [tz, setTz] = useState("UTC");

  const preview = useMemo(() => {
    try {
      return { text: cronstrue.toString(pattern), ok: true };
    } catch {
      return { text: "Invalid cron expression", ok: false };
    }
  }, [pattern]);

  const create = useUpsertScheduler(queue);

  const valid = Boolean(queue && name.trim() && preview.ok);

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Queue">
          <select
            value={queue}
            onChange={(e) => setQueue(e.target.value)}
            className="h-8 w-full rounded-md border border-line bg-canvas px-2 text-sm outline-none focus:border-line-strong"
          >
            {queues.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Job name">
          <Input value={name} onChange={setName} placeholder="daily-digest" />
        </Field>
        <Field label="Scheduler id (optional)">
          <Input value={id} onChange={setId} placeholder="defaults to job name" />
        </Field>
        <Field label="Timezone">
          <Input value={tz} onChange={setTz} placeholder="UTC" />
        </Field>
        <Field label="Cron pattern" full>
          <Input value={pattern} onChange={setPattern} mono placeholder="0 9 * * *" />
        </Field>
      </div>

      <div className={cn("mt-2.5 text-sm", preview.ok ? "text-completed" : "text-failed")}>
        {preview.ok ? `→ ${preview.text}` : preview.text}
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="accent"
          disabled={!valid || create.isPending}
          onClick={() =>
            create.mutate(
              { queue, id: id.trim() || name.trim(), name: name.trim(), pattern, tz },
              {
                onSuccess: () => {
                  toast.success("Schedule created");
                  onDone();
                },
              },
            )
          }
        >
          Create schedule
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the form control is passed in as children
    <label className={cn("flex flex-col gap-1", full && "sm:col-span-2")}>
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-8 w-full rounded-md border border-line bg-canvas px-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-line-strong",
        mono && "font-mono",
      )}
    />
  );
}
