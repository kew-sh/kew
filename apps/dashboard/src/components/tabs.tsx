import type { ReactNode } from "react";
import { cn, compact } from "../lib/utils";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onValueChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="mx-4 mt-3 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line md:mx-8"
    >
      {items.map((t) => {
        const active = t.id === value;

        return (
          <button
            type="button"
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(t.id)}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm transition-colors",
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span className={cn("tnum text-xs", active ? "text-ink-2" : "text-muted")}>
                {compact(t.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
