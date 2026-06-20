import type { BulkAction } from "@kew/core";
import { ArrowUp, RotateCw, Trash2, X } from "lucide-react";
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
  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line-strong bg-overlay/95 p-1.5 pl-3 shadow-2xl backdrop-blur">
        <span className="text-sm tnum">
          <span className="font-medium text-ink">{count}</span>
          <span className="text-muted"> selected</span>
        </span>
        <div className="mx-1 h-5 w-px bg-line" />

        <Button size="sm" variant="subtle" disabled={pending} onClick={() => onAction("retry")}>
          <RotateCw className="size-3.5" />
          Retry
        </Button>
        <Button size="sm" variant="subtle" disabled={pending} onClick={() => onAction("promote")}>
          <ArrowUp className="size-3.5" />
          Promote
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="danger" disabled={pending}>
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {count} jobs?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the {count} selected jobs. BullMQ can't restore removed
                jobs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="danger" onClick={() => onAction("remove")}>
                Remove {count}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
