import { cn } from "../lib/utils";

/** Read-only pretty JSON. Mono, scrollable, no dependency. */
export function JsonView({ value, className }: { value: unknown; className?: string }) {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    text = String(value);
  }
  return (
    <pre
      className={cn(
        "max-h-72 overflow-auto rounded-md border border-line bg-canvas p-3 font-mono text-xs leading-relaxed text-ink-2",
        className,
      )}
    >
      {text}
    </pre>
  );
}
