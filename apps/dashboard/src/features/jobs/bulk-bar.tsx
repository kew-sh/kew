import { useState } from "react";
import { ArrowUp, RotateCw, Trash2, X } from "lucide-react";
import type { BulkAction } from "@kew/core";
import { Button } from "@/components/ui/button";

export function BulkBar({
  count,
  pending,
  onAction,
  onClear,
}: {
  count: number;
  pending: boolean;
  onAction: (action: BulkAction) => void;
  onClear: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line-strong bg-overlay/95 p-1.5 pl-3 shadow-2xl backdrop-blur">
        <span className="text-sm tnum">
          <span className="font-medium text-ink">{count}</span>
          <span className="text-muted"> selected</span>
        </span>
        <div className="mx-1 h-5 w-px bg-line" />

        {confirmRemove ? (
          <>
            <span className="px-1 text-sm text-muted">Remove {count}?</span>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => {
                onAction("remove");
                setConfirmRemove(false);
              }}
            >
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="subtle" disabled={pending} onClick={() => onAction("retry")}>
              <RotateCw className="size-3.5" />
              Retry
            </Button>
            <Button size="sm" variant="subtle" disabled={pending} onClick={() => onAction("promote")}>
              <ArrowUp className="size-3.5" />
              Promote
            </Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => setConfirmRemove(true)}>
              <Trash2 className="size-3.5" />
              Remove
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
              <X className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
