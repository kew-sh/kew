import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type {
  AuthInfo,
  ConnectionInfo,
  Job,
  JobPage,
  QueueSummary,
  Scheduler,
  VersionInfo,
} from "@/lib/api";

export function mkQueue(name: string, over: Partial<QueueSummary> = {}): QueueSummary {
  return {
    name,
    paused: false,
    counts: {
      active: 0,
      waiting: 0,
      prioritized: 0,
      delayed: 0,
      "waiting-children": 0,
      completed: 0,
      failed: 0,
      paused: 0,
    },
    throughput: [],
    failures: [],
    ratePerMin: 0,
    failRate: 0,
    ...over,
  };
}

export function mkJob(id: string, over: Partial<Job> = {}): Job {
  return {
    id,
    name: "job",
    queue: "emails",
    state: "completed",
    attemptsMade: 0,
    maxAttempts: 1,
    priority: 0,
    timestamp: 0,
    data: {},
    opts: {},
    ...over,
  };
}

export function mkPage(jobs: Job[], over: Partial<JobPage> = {}): JobPage {
  return { jobs, total: jobs.length, exact: true, ...over };
}

export const authInfo: AuthInfo = {
  authRequired: false,
  authenticated: true,
  mode: "none",
  requiresUser: false,
};

export const connectionInfo: ConnectionInfo = {
  url: "redis://localhost:6379",
  status: "connected",
  readOnly: false,
  redisVersion: "7.2.0",
};

export const versionInfo: VersionInfo = {
  current: "1.2.2",
  updateAvailable: false,
};

export const scheduler: Scheduler = {
  id: "nightly",
  name: "report",
  pattern: "0 0 * * *",
  tz: "UTC",
};

export const defaultHandlers = [
  http.get("*/api/auth/me", () => HttpResponse.json(authInfo)),
  http.get("*/api/connection", () => HttpResponse.json(connectionInfo)),
  http.get("*/api/version", () => HttpResponse.json(versionInfo)),
  http.get("*/api/queues", () => HttpResponse.json([])),
  http.get("*/api/queues/:name", ({ params }) => HttpResponse.json(mkQueue(String(params.name)))),
  http.get("*/api/queues/:name/jobs", () => HttpResponse.json(mkPage([]))),
  http.get("*/api/queues/:name/schedulers", () => HttpResponse.json([])),
  http.get("*/api/history", () => HttpResponse.json(mkPage([]))),
  http.get("*/api/flows", () => HttpResponse.json([])),
];

export const server = setupServer(...defaultHandlers);
