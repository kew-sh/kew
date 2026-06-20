import type { Job, JobCounts, JobPage } from "./types";

export function sortKey(j: Job): number {
  return j.finishedOn ?? j.timestamp ?? 0;
}

export function mergeJobPages(
  live: JobPage,
  retained: JobPage,
  page: number,
  pageSize: number,
): JobPage {
  const byId = new Map<string, Job>();
  for (const j of live.jobs) byId.set(j.id, j);
  for (const j of retained.jobs) {
    const existing = byId.get(j.id);
    if (!existing) byId.set(j.id, j);
    else if (existing.retained && sortKey(j) > sortKey(existing)) byId.set(j.id, j);
  }

  const merged = [...byId.values()].sort((a, b) => sortKey(b) - sortKey(a));

  const collapsed = live.jobs.length + retained.jobs.length - merged.length;
  const total = Math.max(merged.length, live.total + retained.total - collapsed);
  const start = page * pageSize;

  return {
    jobs: merged.slice(start, start + pageSize),
    total,
    exact: live.exact && retained.exact,
  };
}

export function mergeCounts(
  live: JobCounts,
  retained: { completed: number; failed: number },
  overlap: { completed: number; failed: number },
): JobCounts {
  return {
    ...live,
    completed: Math.max(0, live.completed + retained.completed - overlap.completed),
    failed: Math.max(0, live.failed + retained.failed - overlap.failed),
  };
}
