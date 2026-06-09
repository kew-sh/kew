import type { QueueApi } from "./api";
import { client } from "./client";
import type {
  AuthInfo,
  ConnectionInfo,
  FlowNode,
  JobPage,
  QueueSummary,
  Scheduler,
  VersionInfo,
} from "./types";

const enc = encodeURIComponent;

export const httpApi: QueueApi = {
  getAuth: () => client.get<AuthInfo>("/auth/me").then((r) => r.data),

  async login({ email, password }) {
    await client.post("/auth/login", { email, password });
  },

  async logout() {
    await client.post("/auth/logout");
  },

  getConnection: () => client.get<ConnectionInfo>("/connection").then((r) => r.data),

  getVersion: () => client.get<VersionInfo>("/version").then((r) => r.data),

  listQueues: () => client.get<QueueSummary[]>("/queues").then((r) => r.data),

  getQueue: (name) =>
    client.get<QueueSummary | undefined>(`/queues/${enc(name)}`).then((r) => r.data),

  async setQueuePaused({ queue, paused }) {
    await client.post(`/queues/${enc(queue)}/${paused ? "pause" : "resume"}`);
  },

  getJobs: (query) =>
    client
      .get<JobPage>(`/queues/${enc(query.queue)}/jobs`, {
        params: {
          state: query.state,
          page: query.page,
          pageSize: query.pageSize,
          search: query.search,
        },
      })
      .then((r) => r.data),

  getHistory: (query) =>
    client
      .get<JobPage>("/history", {
        params: {
          queue: query.queue,
          state: query.state,
          from: query.from,
          to: query.to,
          search: query.search,
          page: query.page,
          pageSize: query.pageSize,
        },
      })
      .then((r) => r.data),

  bulkAction: ({ queue, ids, action }) =>
    client
      .post<{ affected: number }>(`/queues/${enc(queue)}/jobs/bulk`, { ids, action })
      .then((r) => r.data),

  async retryWithData({ queue, id, data }) {
    await client.post(`/queues/${enc(queue)}/jobs/${enc(id)}/retry-with-data`, { data });
  },

  rerun: ({ queue, id, data }) =>
    client
      .post<{ id: string }>(
        `/queues/${enc(queue)}/jobs/${enc(id)}/rerun`,
        data !== undefined ? { data } : undefined,
      )
      .then((r) => r.data),

  listSchedulers: (queue) =>
    client.get<Scheduler[]>(`/queues/${enc(queue)}/schedulers`).then((r) => r.data),

  async upsertScheduler(input) {
    await client.post(`/queues/${enc(input.queue)}/schedulers`, input);
  },

  async removeScheduler({ queue, id }) {
    await client.delete(`/queues/${enc(queue)}/schedulers/${enc(id)}`);
  },

  listFlows: () => client.get<FlowNode[]>("/flows").then((r) => r.data),
};
