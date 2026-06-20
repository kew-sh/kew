import type { JobState, QueueSummary } from "./api/types";

export function queueHealth(q: QueueSummary): JobState {
  if (q.paused) return "paused";
  if (q.failRate > 0.08 || q.counts.failed > 50) return "failed";
  if (q.counts.active > 0) return "active";
  if (q.counts.waiting > 0) return "waiting";

  return "completed";
}

export function backlog(q: QueueSummary): number {
  return q.counts.waiting + q.counts.prioritized + q.counts.active;
}
