import { Check, Info, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "../lib/utils";

type ToastType = "error" | "success" | "info";
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let items: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(type: ToastType, message: string) {
  const id = ++seq;

  items = [...items, { id, type, message }];
  emit();
  setTimeout(() => dismiss(id), 4500);
}

export const toast = {
  error: (message: string) => push("error", message),
  success: (message: string) => push("success", message),
  info: (message: string) => push("info", message),
};

const ICON: Record<ToastType, typeof X> = { error: X, success: Check, info: Info };
const TONE: Record<ToastType, string> = {
  error: "text-failed",
  success: "text-completed",
  info: "text-accent",
};

export function Toaster() {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {current.map((t) => {
        const Icon = ICON[t.type];

        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-line-strong bg-overlay/95 px-3 py-2.5 text-sm shadow-2xl backdrop-blur"
          >
            <Icon
              className={cn("mt-px size-4 shrink-0", TONE[t.type])}
              strokeWidth={2.5}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-ink-2">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-mr-1 shrink-0 rounded p-0.5 text-muted transition-colors hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
