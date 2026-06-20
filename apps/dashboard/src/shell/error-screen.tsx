import { AlertTriangle, Home, RotateCw } from "lucide-react";
import { Button } from "../components/ui/button";

export function ErrorScreen({ error, reset }: { error: Error; reset?: () => void }) {
  const message = error?.message || "An unexpected error occurred.";

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6 py-10 text-ink">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-xl border border-failed/30 bg-failed/10 text-failed">
            <AlertTriangle className="size-6" strokeWidth={2.25} aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-1 max-w-sm text-sm text-muted">
            The dashboard hit an unexpected error. Your queues and Redis data are untouched — this
            is a UI-side error.
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
          <div className="border-b border-line px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            Error
          </div>
          <pre className="max-h-44 overflow-auto p-3 font-mono text-xs leading-relaxed text-failed">
            {message}
          </pre>
          {import.meta.env.DEV && error?.stack && (
            <details className="border-t border-line">
              <summary className="cursor-pointer px-3 py-2 text-xs text-muted transition-colors hover:text-ink">
                Stack trace
              </summary>
              <pre className="max-h-60 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-ink-2">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {reset && (
            <Button variant="accent" onClick={reset}>
              <RotateCw className="size-3.5" />
              Try again
            </Button>
          )}
          <Button variant="subtle" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button variant="ghost" onClick={() => window.location.assign("/")}>
            <Home className="size-3.5" />
            Overview
          </Button>
        </div>
      </div>
    </div>
  );
}
