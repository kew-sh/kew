import { FlowProducer, type JobNode, Queue } from "bullmq";
import type { Redis } from "ioredis";
import type {
  BulkAction,
  FlowNode,
  Job,
  JobCounts,
  JobPage,
  JobState,
  QueueSummary,
  Scheduler,
  SchedulerInput,
} from "../types";
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

const cache = new Map<string, Queue>();
export function getQueue(name: string, connection: Redis): Queue {
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, { connection, prefix: BULLMQ_PREFIX });
    cache.set(name, q);
  }
  return q;
}

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

async function applyOne(q: Queue, id: string, action: BulkAction): Promise<boolean> {
  const job = await q.getJob(id);
  if (!job) return false;
  try {
    if (action === "retry") await job.retry();
    else if (action === "promote") await job.promote();
    else await job.remove();
    return true;
  } catch {
    return false;
  }
}

export async function applyBulk(
  name: string,
  ids: string[],
  action: BulkAction,
  redis: Redis,
): Promise<{ affected: number }> {
  const q = getQueue(name, redis);
  let affected = 0;
  for (const id of ids) {
    if (await applyOne(q, id, action)) affected++;
  }
  return { affected };
}

export async function retryWithData(
  name: string,
  id: string,
  data: unknown,
  redis: Redis,
): Promise<void> {
  const job = await getQueue(name, redis).getJob(id);
  if (!job) throw new Error(`job ${id} not found in ${name}`);
  await job.updateData(data as never);
  await job.retry();
}

export async function setQueuePaused(name: string, paused: boolean, redis: Redis): Promise<void> {
  const q = getQueue(name, redis);
  if (paused) await q.pause();
  else await q.resume();
}

export async function listSchedulers(name: string, redis: Redis): Promise<Scheduler[]> {
  const raw = await getQueue(name, redis).getJobSchedulers(0, -1, true);
  return raw.map((s) => ({
    id: s.key,
    name: s.name,
    pattern: s.pattern ?? undefined,
    every: s.every ?? undefined,
    tz: s.tz ?? undefined,
    next: s.next ?? undefined,
    data: s.template?.data,
  }));
}

export async function upsertScheduler(input: SchedulerInput, redis: Redis): Promise<void> {
  const repeat = input.pattern
    ? { pattern: input.pattern, tz: input.tz }
    : { every: input.every ?? 0 };
  await getQueue(input.queue, redis).upsertJobScheduler(input.id, repeat, {
    name: input.name,
    data: input.data,
  });
}

export async function removeScheduler(name: string, id: string, redis: Redis): Promise<void> {
  await getQueue(name, redis).removeJobScheduler(id);
}

const FLOW_PARENT_SCAN = 25;

async function safeGetFlow(
  flow: FlowProducer,
  id: string,
  queueName: string,
): Promise<JobNode | null> {
  try {
    return await flow.getFlow({
      id,
      queueName,
      prefix: BULLMQ_PREFIX,
      depth: 4,
      maxChildren: 50,
    });
  } catch {
    return null;
  }
}

async function toFlowNode(node: JobNode): Promise<FlowNode> {
  const { job, children } = node;
  const state = await job.getState();
  return {
    id: String(job.id),
    name: job.name,
    queue: job.queueName,
    state: state === "unknown" ? "waiting" : state,
    children: children ? await Promise.all(children.map(toFlowNode)) : [],
  };
}

export async function listFlows(redis: Redis): Promise<FlowNode[]> {
  const names = await discoverQueues(redis);
  const flow = new FlowProducer({ connection: redis, prefix: BULLMQ_PREFIX });
  const roots: FlowNode[] = [];

  for (const name of names) {
    let parents: import("bullmq").Job[] = [];
    try {
      parents = await getQueue(name, redis).getJobs(
        ["waiting-children"],
        0,
        FLOW_PARENT_SCAN - 1,
        false,
      );
    } catch {
      continue;
    }
    for (const p of parents) {
      if (!p?.id) continue;
      const node = await safeGetFlow(flow, String(p.id), name);
      if (node) roots.push(await toFlowNode(node));
    }
  }

  const childIds = new Set<string>();
  const walk = (n: FlowNode) => {
    for (const c of n.children) {
      childIds.add(c.id);
      walk(c);
    }
  };
  for (const r of roots) walk(r);
  return roots.filter((r) => !childIds.has(r.id));
}
