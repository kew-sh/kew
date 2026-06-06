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

export interface HistoryQuery {
  queue?: string;
  state?: "completed" | "failed";
  from?: number;
  to?: number;
  search?: string;
  page: number;
  pageSize: number;
}

export interface ConnectionInfo {
  url: string;
  status: "connected" | "connecting" | "error";
  readOnly: boolean;
  redisVersion: string;
}

export interface AuthInfo {
  authRequired: boolean;
  authenticated: boolean;
  mode: "none" | "password" | "proxy";
  requiresUser: boolean;
  user?: string;
}

export type BulkAction = "retry" | "remove" | "promote";

export interface Scheduler {
  id: string;
  name: string;
  /** cron expression, e.g. "0 9 * * *" */
  pattern?: string;
  /** or a fixed interval in ms (mutually exclusive with pattern) */
  every?: number;
  /** IANA timezone for the cron, e.g. "America/Sao_Paulo" */
  tz?: string;
  /** next run timestamp (ms); BullMQ provides this via getJobSchedulers */
  next?: number;
  /** template payload for the jobs this scheduler produces */
  data?: unknown;
}

export interface SchedulerInput {
  queue: string;
  id: string;
  name: string;
  pattern?: string;
  every?: number;
  tz?: string;
  data?: unknown;
}

/** A node in a BullMQ Flow tree (parent waits for children to complete). */
export interface FlowNode {
  id: string;
  name: string;
  queue: string;
  state: JobState;
  children: FlowNode[];
}
