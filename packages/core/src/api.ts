import { httpApi } from "./http";
import type {
  AuthInfo,
  BulkAction,
  ConnectionInfo,
  FlowNode,
  HistoryQuery,
  JobPage,
  JobQuery,
  QueueSummary,
  Scheduler,
  SchedulerInput,
} from "./types";

export interface QueueApi {
  getAuth(): Promise<AuthInfo>;
  login(input: { email?: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  getConnection(): Promise<ConnectionInfo>;
  listQueues(): Promise<QueueSummary[]>;
  getQueue(name: string): Promise<QueueSummary | undefined>;
  setQueuePaused(input: { queue: string; paused: boolean }): Promise<void>;
  getJobs(query: JobQuery): Promise<JobPage>;
  getHistory(query: HistoryQuery): Promise<JobPage>;
  bulkAction(input: {
    queue: string;
    ids: string[];
    action: BulkAction;
  }): Promise<{ affected: number }>;
  retryWithData(input: { queue: string; id: string; data: unknown }): Promise<void>;
  listSchedulers(queue: string): Promise<Scheduler[]>;
  upsertScheduler(input: SchedulerInput): Promise<void>;
  removeScheduler(input: { queue: string; id: string }): Promise<void>;
  listFlows(): Promise<FlowNode[]>;
}

export const api: QueueApi = httpApi;
