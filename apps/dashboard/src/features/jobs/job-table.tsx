import type { Job } from "@kew/core";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  type OnChangeFn,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { StateBadge } from "@/components/state-badge";
import { cn, duration, relativeTime } from "@/lib/utils";

const GRID = "grid grid-cols-[34px_minmax(0,1fr)_132px_72px_64px_84px] items-center gap-3 px-3";

const helper = createColumnHelper<Job>();

const columns = [
  helper.display({
    id: "select",
    header: ({ table }) => (
      <Check
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        label="Select all jobs"
      />
    ),
    cell: ({ row }) => (
      <Check
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        label={`Select job ${row.original.id}`}
      />
    ),
  }),
  helper.accessor("name", {
    header: "Job",
    cell: ({ row }) => {
      const j = row.original;
      return (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted">#{j.id}</span>
            <span className="truncate font-medium">{j.name}</span>
          </div>
          {j.failedReason && (
            <div className="truncate font-mono text-xs text-failed/90">{j.failedReason}</div>
          )}
        </div>
      );
    },
  }),
  helper.accessor("state", {
    header: "State",
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
  }),
  helper.accessor("attemptsMade", {
    header: "Tries",
    cell: ({ row }) => (
      <span className="tnum text-ink-2">
        {row.original.attemptsMade}
        <span className="text-muted">/{row.original.maxAttempts}</span>
      </span>
    ),
  }),
  helper.accessor("timestamp", {
    header: "Age",
    cell: ({ getValue }) => <span className="tnum text-ink-2">{relativeTime(getValue())}</span>,
  }),
  helper.accessor("durationMs", {
    header: "Duration",
    cell: ({ getValue }) => {
      const d = getValue();
      return <span className="tnum text-ink-2">{d != null ? duration(d) : "—"}</span>;
    },
  }),
];

export function JobTable({
  jobs,
  selection,
  onSelectionChange,
  onOpenJob,
  readOnly,
}: {
  jobs: Job[];
  selection: RowSelectionState;
  onSelectionChange: OnChangeFn<RowSelectionState>;
  onOpenJob: (job: Job) => void;
  readOnly: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const table = useReactTable({
    data: jobs,
    columns,
    state: { rowSelection: selection },
    enableRowSelection: !readOnly,
    onRowSelectionChange: onSelectionChange,
    getRowId: (j) => j.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 14,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line">
      <div
        className={cn(
          GRID,
          "h-9 shrink-0 border-b border-line bg-surface text-[11px] font-medium uppercase tracking-wider text-muted",
        )}
      >
        {table.getHeaderGroups()[0].headers.map((h) => (
          <div key={h.id} className={cn(h.column.id === "durationMs" && "text-right")}>
            {flexRender(h.column.columnDef.header, h.getContext())}
          </div>
        ))}
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize() }} className="relative w-full">
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={row.id}
                data-selected={row.getIsSelected()}
                onClick={() => onOpenJob(row.original)}
                className={cn(
                  GRID,
                  "absolute inset-x-0 cursor-pointer border-b border-line/40 text-sm transition-colors hover:bg-surface data-[selected=true]:bg-accent/10",
                )}
                style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    onClick={cell.column.id === "select" ? (e) => e.stopPropagation() : undefined}
                    className={cn("min-w-0", cell.column.id === "durationMs" && "text-right")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Check({
  checked,
  indeterminate,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (e: unknown) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked;
      }}
      onChange={onChange}
      className="size-3.5 cursor-pointer rounded border-line-strong accent-accent disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}
