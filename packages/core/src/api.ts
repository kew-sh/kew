import * as mock from "./mock";
import type {
  BulkAction,
  ConnectionInfo,
  JobPage,
  JobQuery,
  QueueSummary,
} from "./types";

/**
 * The single contract the UI talks to. Today it is mock-backed; the Bun+Redis
 * backend implements the same interface (over fetch) with zero UI changes.
 * Keep this surface aligned with BullMQ's QueueGetters + Job actions.
 */
export interface QueueApi {
  getConnection(): Promise<ConnectionInfo>;
  listQueues(): Promise<QueueSummary[]>;
  getQueue(name: string): Promise<QueueSummary | undefined>;
  getJobs(query: JobQuery): Promise<JobPage>;
  bulkAction(input: {
    queue: string;
    ids: string[];
    action: BulkAction;
  }): Promise<{ affected: number }>;
}

const latency = (min = 60, max = 220) =>
  new Promise<void>((r) => setTimeout(r, min + Math.random() * (max - min)));

export const READ_ONLY = false;

export const api: QueueApi = {
  async getConnection() {
    await latency(20, 60);
    return {
      url: "redis://localhost:6379",
      status: "connected",
      readOnly: READ_ONLY,
      redisVersion: "7.4.1",
    };
  },

  async listQueues() {
    await latency();
    return mock.getQueues();
  },

  async getQueue(name) {
    await latency();
    return mock.getQueue(name);
  },

  async getJobs(query) {
    await latency();
    const all = mock.getJobs(query.queue, query.state);
    const term = query.search?.trim().toLowerCase();
    const filtered = term
      ? all.filter((j) =>
          [j.id, j.name, JSON.stringify(j.data)].join(" ").toLowerCase().includes(term),
        )
      : all;
    const start = query.page * query.pageSize;
    return {
      jobs: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      exact: !term,
    };
  },

  async bulkAction({ queue, ids, action }) {
    await latency(80, 260);
    return { affected: mock.bulkAction(queue, ids, action) };
  },
};
