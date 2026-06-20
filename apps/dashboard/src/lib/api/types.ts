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
  throughput: number[];
  failures: number[];
  ratePerMin: number;
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
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  durationMs?: number;
  delayUntil?: number;
  data: unknown;
  opts: Record<string, unknown>;
  returnValue?: unknown;
  failedReason?: string;
  stacktrace?: string[];
  logs?: string[];
  childCount?: number;
  retained?: boolean;
}

export interface JobPage {
  jobs: Job[];
  total: number;
  exact: boolean;
}

export interface JobQuery {
  queue: string;
  state: JobState;
  page: number;
  pageSize: number;
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

export interface VersionInfo {
  current: string;
  latest?: string;
  updateAvailable: boolean;
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
  pattern?: string;
  every?: number;
  tz?: string;
  next?: number;
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

export interface FlowNode {
  id: string;
  name: string;
  queue: string;
  state: JobState;
  children: FlowNode[];
}
