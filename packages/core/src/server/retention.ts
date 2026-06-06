import { type Job, QueueEvents } from "bullmq";
import type { Redis } from "ioredis";
import { getQueue } from "./queue-service";
import { BULLMQ_PREFIX } from "./redis";

export interface RetainedJob {
  queue: string;
  jobId: string;
  name: string;
  state: "completed" | "failed";
  data?: unknown;
  opts?: Record<string, unknown>;
  returnValue?: unknown;
  failedReason?: string;
  attemptsMade?: number;
  timestamp?: number;
  processedOn?: number;
  finishedOn?: number;
  durationMs?: number;
  capturedAt: number;
  payloadCaptured: boolean;
}

export interface RetentionSink {
  write(records: RetainedJob[]): void | Promise<void>;
}

export interface RetentionOptions {
  capturePayload?: boolean;
  flushIntervalMs?: number;
  flushMaxBatch?: number;
  bufferTtlMs?: number;
  discoverIntervalMs?: number;
}

export interface RetentionHandle {
  whenReady(): Promise<void>;
  stop(): Promise<void>;
}

interface Snapshot {
  name: string;
  data: unknown;
  opts: Record<string, unknown>;
  timestamp?: number;
  attemptsMade?: number;
}

interface Pending {
  promise: Promise<Snapshot | null>;
  at: number;
}

interface Listener {
  events: QueueEvents;
  connection: Redis;
  pending: Map<string, Pending>;
}

const DEFAULTS = {
  capturePayload: true,
  flushIntervalMs: 1000,
  flushMaxBatch: 500,
  bufferTtlMs: 300_000,
  discoverIntervalMs: 2500,
};

function parseMaybe(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function snapshotOf(job: Job): Snapshot {
  return {
    name: job.name,
    data: job.data,
    opts: (job.opts as Record<string, unknown>) ?? {},
    timestamp: job.timestamp ?? undefined,
    attemptsMade: job.attemptsMade ?? undefined,
  };
}

export function startRetention(
  redis: Redis,
  getNames: () => Promise<string[]>,
  sink: RetentionSink,
  options: RetentionOptions = {},
): RetentionHandle {
  const opts = { ...DEFAULTS, ...options };

  const listeners = new Map<string, Listener>();
  let outBuffer: RetainedJob[] = [];

  let stopped = false;
  let discovering = false;
  let flushing = false;

  async function finalize(
    queue: string,
    pending: Map<string, Pending>,
    jobId: string,
    state: RetainedJob["state"],
    outcome: { returnValue?: unknown; failedReason?: string },
  ): Promise<void> {
    const entry = pending.get(jobId);
    pending.delete(jobId);

    let snapshot = entry ? await entry.promise : null;
    if (!snapshot) {
      const job = await getQueue(queue, redis)
        .getJob(jobId)
        .catch(() => undefined);
      snapshot = job ? snapshotOf(job) : null;
    }

    const now = Date.now();
    outBuffer.push({
      queue,
      jobId,
      name: snapshot?.name ?? "",
      state,
      data: snapshot?.data,
      opts: snapshot?.opts,
      returnValue: outcome.returnValue,
      failedReason: outcome.failedReason,
      attemptsMade: snapshot?.attemptsMade,
      timestamp: snapshot?.timestamp,
      processedOn: entry?.at,
      finishedOn: now,
      durationMs: entry ? now - entry.at : undefined,
      capturedAt: now,
      payloadCaptured: Boolean(snapshot),
    });

    if (outBuffer.length >= opts.flushMaxBatch) void flush();
  }

  async function attach(queue: string): Promise<void> {
    if (listeners.has(queue)) return;

    const connection = redis.duplicate();
    const events = new QueueEvents(queue, { connection, prefix: BULLMQ_PREFIX });
    const pending = new Map<string, Pending>();
    listeners.set(queue, { events, connection, pending });

    const capture = (jobId: string) => {
      if (!opts.capturePayload || stopped || pending.has(jobId)) return;
      const promise = getQueue(queue, redis)
        .getJob(jobId)
        .then((job) => (job ? snapshotOf(job) : null))
        .catch(() => null);
      pending.set(jobId, { promise, at: Date.now() });
    };

    events.on("active", ({ jobId }) => capture(jobId));
    events.on(
      "completed",
      ({ jobId, returnvalue }) =>
        void finalize(queue, pending, jobId, "completed", { returnValue: parseMaybe(returnvalue) }),
    );
    events.on(
      "failed",
      ({ jobId, failedReason }) => void finalize(queue, pending, jobId, "failed", { failedReason }),
    );
    events.on("error", () => {});

    try {
      await events.waitUntilReady();
    } catch {
      listeners.delete(queue);
      await events.close().catch(() => {});
      await connection.quit().catch(() => {});
    }
  }

  async function detach(queue: string): Promise<void> {
    const listener = listeners.get(queue);
    if (!listener) return;
    listeners.delete(queue);
    listener.pending.clear();
    await listener.events.close().catch(() => {});
    await listener.connection.quit().catch(() => {});
  }

  async function discover(): Promise<void> {
    if (discovering || stopped) return;
    discovering = true;
    try {
      const names = await getNames();
      const live = new Set(names);
      for (const name of names) {
        if (!listeners.has(name)) await attach(name);
      }
      for (const name of [...listeners.keys()]) {
        if (!live.has(name)) await detach(name);
      }
    } catch {
    } finally {
      discovering = false;
    }
  }

  function sweep(): void {
    const cutoff = Date.now() - opts.bufferTtlMs;
    for (const { pending } of listeners.values()) {
      for (const [jobId, entry] of pending) {
        if (entry.at < cutoff) pending.delete(jobId);
      }
    }
  }

  async function flush(): Promise<void> {
    if (flushing) return;
    flushing = true;
    try {
      while (outBuffer.length > 0) {
        const batch = outBuffer.splice(0, opts.flushMaxBatch);
        try {
          await sink.write(batch);
        } catch {
          outBuffer = [...batch, ...outBuffer];
          break;
        }
      }
    } finally {
      flushing = false;
    }
  }

  const ready = discover();

  const discoverTimer = setInterval(() => void discover(), opts.discoverIntervalMs);
  const flushTimer = setInterval(() => {
    sweep();
    void flush();
  }, opts.flushIntervalMs);

  return {
    whenReady: () => ready,
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(discoverTimer);
      clearInterval(flushTimer);
      for (const name of [...listeners.keys()]) await detach(name);
      await flush();
    },
  };
}
