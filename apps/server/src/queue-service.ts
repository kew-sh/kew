import type { Job, JobCounts, JobPage, JobState, QueueSummary } from "@kew/core/types";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { BULLMQ_PREFIX } from "./redis";
import { getWindow } from "./sampler";

export const STATES: JobState[] = [
  "active",
  "waiting",
  "prioritized",
  "delayed",
  "waiting-children",
  "completed",
  "failed",
  "paused",
];

const SEARCH_SCAN_LIMIT = 500;

/** Cache Queue instances; they're cheap getters sharing one connection. */
const cache = new Map<string, Queue>();
export function getQueue(name: string, connection: Redis): Queue {
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, { connection, prefix: BULLMQ_PREFIX });
    cache.set(name, q);
  }
  return q;
}

/** BullMQ has no "list queues"; discover by scanning for `<prefix>:<name>:meta`. */
export async function discoverQueues(redis: Redis): Promise<string[]> {
  const names = new Set<string>();
  const re = new RegExp(`^${BULLMQ_PREFIX}:(.+):meta$`);
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `${BULLMQ_PREFIX}:*:meta`, "COUNT", 250);
    cursor = next;
    for (const key of keys) {
      const m = re.exec(key);
      if (m) names.add(m[1]);
    }
  } while (cursor !== "0");
  return [...names].sort();
}

export async function getQueueSummary(name: string, redis: Redis): Promise<QueueSummary> {
  const q = getQueue(name, redis);
  const [raw, paused] = await Promise.all([q.getJobCounts(...STATES), q.isPaused()]);
  const counts = STATES.reduce((acc, s) => {
    acc[s] = (raw as Record<string, number>)[s] ?? 0;
    return acc;
  }, {} as JobCounts);
  const win = getWindow(name);
  return { name, paused, counts, ...win };
}

function mapJob(j: import("bullmq").Job, state: JobState): Job {
  const processedOn = j.processedOn ?? undefined;
  const finishedOn = j.finishedOn ?? undefined;
  return {
    id: String(j.id),
    name: j.name,
    queue: j.queueName,
    state,
    attemptsMade: j.attemptsMade ?? 0,
    maxAttempts: (j.opts?.attempts as number) ?? 1,
    priority: (j.opts?.priority as number) ?? 0,
    timestamp: j.timestamp ?? Date.now(),
    processedOn,
    finishedOn,
    durationMs: processedOn && finishedOn ? finishedOn - processedOn : undefined,
    data: j.data,
    opts: (j.opts as Record<string, unknown>) ?? {},
    returnValue: j.returnvalue ?? undefined,
    failedReason: j.failedReason ?? undefined,
    stacktrace: j.stacktrace ?? undefined,
  };
}

export async function getJobsPage(
  name: string,
  state: JobState,
  page: number,
  pageSize: number,
  search: string | undefined,
  redis: Redis,
): Promise<JobPage> {
  const q = getQueue(name, redis);
  const start = page * pageSize;

  if (search) {
    // Redis can't index job data; do a bounded scan and filter. Honest: exact=false.
    const scanned = await q.getJobs([state], 0, SEARCH_SCAN_LIMIT - 1, false);
    const term = search.toLowerCase();
    const matched = scanned.filter((j) =>
      `${j.id} ${j.name} ${JSON.stringify(j.data)}`.toLowerCase().includes(term),
    );
    return {
      jobs: matched.slice(start, start + pageSize).map((j) => mapJob(j, state)),
      total: matched.length,
      exact: false,
    };
  }

  const counts = await q.getJobCounts(state);
  const raw = await q.getJobs([state], start, start + pageSize - 1, false);
  return {
    jobs: raw.map((j) => mapJob(j, state)),
    total: (counts as Record<string, number>)[state] ?? raw.length,
    exact: true,
  };
}
