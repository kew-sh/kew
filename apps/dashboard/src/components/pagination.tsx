import { ChevronLeft, ChevronRight } from "lucide-react";
import { compact } from "../lib/utils";
import { Button } from "./ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  count,
  exact = true,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  count: number;
  exact?: boolean;
  onPageChange: (page: number) => void;
}) {
  const start = page * pageSize;
  const hasNext = start + pageSize < total;

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="tnum">
        {total === 0 ? "0" : `${start + 1}–${start + count}`} of {compact(total)}
        {exact ? "" : "+"}
      </span>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
