/**
 * Domain contract. These shapes mirror real BullMQ so the mock and the future
 * Bun+Redis backend are interchangeable behind `QueueApi`. When the backend
 * lands, this file moves to `packages/core` and both consumers reuse it.
 */

export const JOB_STATES = [
  "active",
  "waiting",
  "prioritized",
  "delayed",
  "waiting-children",
  "completed",
  "failed",
  "paused",
] as const;

export type JobState = (typeof JOB_STATES)[number];

export type JobCounts = Record<JobState, number>;

export interface QueueSummary {
  name: string;
  paused: boolean;
  counts: JobCounts;
  /** Completed jobs/min over the last ~30 buckets (for the sparkline). */
  throughput: number[];
  /** Failed jobs/min over the same window (overlay line). */
  failures: number[];
  /** Jobs processed per minute, latest bucket. */
  ratePerMin: number;
  /** failed / (completed + failed) over the window, 0..1. */
  failRate: number;
}

export interface JobAttempt {
  at: number;
  error: string;
}

export interface Job {
  id: string;
  name: string;
  queue: string;
  state: JobState;
  attemptsMade: number;
  maxAttempts: number;
  priority: number;
  /** When the job was created (ms). */
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  /** ms, present for completed/active. */
  durationMs?: number;
  delayUntil?: number;
  data: unknown;
  opts: Record<string, unknown>;
  returnValue?: unknown;
  failedReason?: string;
  stacktrace?: string[];
  logs?: string[];
  /** Number of children, when this is a flow parent. */
  childCount?: number;
}

export interface JobPage {
  jobs: Job[];
  total: number;
  /** True when `total` is an exact count; false when it is a scanned estimate. */
  exact: boolean;
}

export interface JobQuery {
  queue: string;
  state: JobState;
  page: number;
  pageSize: number;
  /** Free-text match against id, name, and payload (bounded scan). */
  search?: string;
}

export interface ConnectionInfo {
  url: string;
  status: "connected" | "connecting" | "error";
  readOnly: boolean;
  redisVersion: string;
}

export type BulkAction = "retry" | "remove" | "promote";
