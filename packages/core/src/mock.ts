import {
  JOB_STATES,
  type Job,
  type JobCounts,
  type JobState,
  type QueueSummary,
} from "./types";

/**
 * A small deterministic-ish world of BullMQ queues that evolves over time, so
 * the UI feels live without a backend. Replaced wholesale by the real Redis
 * connector later; nothing else in the app knows this is fake.
 */

let seed = 1337;
function rng(): number {
  // mulberry32 — deterministic start, varied output
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function int(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

const JOB_NAMES: Record<string, string[]> = {
  emails: ["welcome-email", "password-reset", "digest", "receipt", "reminder"],
  "media-processing": ["transcode-video", "generate-thumbnail", "optimize-image"],
  webhooks: ["stripe-event", "github-event", "deliver-callback"],
  "ai-inference": ["embed-document", "summarize", "moderate", "generate-reply"],
  exports: ["csv-export", "pdf-report", "backfill"],
  notifications: ["push", "sms", "in-app"],
};

interface QueueState {
  name: string;
  paused: boolean;
  counts: JobCounts;
  throughput: number[];
  failures: number[];
  jobs: Job[];
}

function emptyCounts(): JobCounts {
  return JOB_STATES.reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {} as JobCounts);
}

function makeJob(queue: string, state: JobState, ageMs: number): Job {
  const names = JOB_NAMES[queue] ?? ["job"];
  const name = pick(names);
  const now = Date.now();
  const timestamp = now - ageMs;
  const maxAttempts = pick([1, 3, 3, 5]);
  const attemptsMade =
    state === "failed" ? maxAttempts : state === "active" ? int(0, 1) : int(0, maxAttempts - 1);
  const durationMs =
    state === "completed" || state === "active" ? int(45, 9000) : undefined;

  const data: Record<string, unknown> = {
    userId: `usr_${int(1000, 9999)}`,
    attempt: attemptsMade,
  };
  if (queue === "emails") data.to = `user${int(1, 999)}@example.com`;
  if (queue === "ai-inference") {
    data.model = pick(["gpt-4o", "claude-sonnet", "llama-3"]);
    data.tokens = int(200, 8000);
  }
  if (queue === "media-processing") data.assetId = `ast_${int(10000, 99999)}`;

  const job: Job = {
    id: String(int(100000, 999999)),
    name,
    queue,
    state,
    attemptsMade,
    maxAttempts,
    priority: pick([0, 0, 0, 1, 2]),
    timestamp,
    data,
    opts: { attempts: maxAttempts, backoff: { type: "exponential", delay: 2000 } },
    durationMs,
  };
  if (state === "active" || state === "completed") job.processedOn = timestamp + int(10, 500);
  if (state === "completed") job.finishedOn = (job.processedOn ?? timestamp) + (durationMs ?? 0);
  if (state === "delayed") job.delayUntil = now + int(5_000, 600_000);
  if (state === "waiting-children") job.childCount = int(2, 6);
  if (state === "completed") job.returnValue = { ok: true, ms: durationMs };
  if (state === "failed") {
    const err = pick([
      "TimeoutError: request timed out after 30000ms",
      "Error: ECONNREFUSED 10.0.1.4:6379",
      "RateLimitError: 429 Too Many Requests",
      "TypeError: Cannot read properties of undefined (reading 'id')",
      "Error: provider returned 503 Service Unavailable",
    ]);
    job.failedReason = err;
    job.stacktrace = [
      err,
      "    at process (/app/src/worker.ts:42:11)",
      "    at async Worker.processJob (/app/node_modules/bullmq/dist/worker.js:531:24)",
    ];
  }
  job.logs = [
    `[${new Date(timestamp).toISOString()}] picked up by worker-${int(1, 4)}`,
    state === "failed" ? `[error] attempt ${attemptsMade}/${maxAttempts} failed` : `processing ${name}`,
  ];
  return job;
}

function makeQueue(
  name: string,
  profile: "healthy" | "failing" | "backed-up" | "paused" | "idle",
): QueueState {
  const counts = emptyCounts();
  const jobs: Job[] = [];

  const spec: Record<typeof profile, Partial<Record<JobState, number>>> = {
    healthy: { active: int(2, 6), waiting: int(0, 12), completed: int(8000, 40000), failed: int(0, 4), delayed: int(0, 3) },
    failing: { active: int(1, 4), waiting: int(20, 80), completed: int(3000, 9000), failed: int(140, 520), delayed: int(2, 9), prioritized: int(0, 3) },
    "backed-up": { active: int(8, 16), waiting: int(800, 4200), completed: int(20000, 60000), failed: int(10, 40), delayed: int(20, 120), prioritized: int(2, 8) },
    paused: { active: 0, waiting: int(40, 200), completed: int(1000, 4000), failed: int(2, 20), delayed: int(0, 5) },
    idle: { active: 0, waiting: 0, completed: int(200, 2000), failed: int(0, 2) },
  };

  for (const [state, n] of Object.entries(spec[profile]) as [JobState, number][]) {
    counts[state] = n;
    // materialize a sample of real jobs per state for the table (cap for memory)
    const sample = Math.min(n, 60);
    for (let i = 0; i < sample; i++) {
      jobs.push(makeJob(name, state, int(2_000, 4 * 3600_000)));
    }
  }

  const throughput = Array.from({ length: 30 }, () => {
    const base = profile === "backed-up" ? 80 : profile === "idle" ? 2 : profile === "paused" ? 0 : 30;
    return Math.max(0, base + int(-base, base));
  });
  const failures = Array.from({ length: 30 }, () =>
    profile === "failing" ? int(2, 18) : profile === "paused" ? 0 : int(0, 3),
  );

  return { name, paused: profile === "paused", counts, throughput, failures, jobs };
}

const world: QueueState[] = [
  makeQueue("ai-inference", "failing"),
  makeQueue("media-processing", "backed-up"),
  makeQueue("emails", "healthy"),
  makeQueue("webhooks", "healthy"),
  makeQueue("exports", "paused"),
  makeQueue("notifications", "idle"),
];

/** Advance the world a little: complete some active work, churn counts. */
function tick() {
  for (const q of world) {
    if (q.paused) continue;
    const done = int(0, Math.min(q.counts.active, 5));
    q.counts.completed += done;
    const pulled = Math.min(q.counts.waiting, int(0, 6));
    q.counts.waiting -= pulled;
    q.counts.active = Math.max(0, q.counts.active + pulled - done);
    if (rng() > 0.6) q.counts.failed += int(0, q.name === "ai-inference" ? 4 : 1);
    q.throughput = [...q.throughput.slice(1), done * int(4, 8)];
    q.failures = [...q.failures.slice(1), q.name === "ai-inference" ? int(0, 12) : int(0, 2)];
  }
}
setInterval(tick, 1500);

export function bulkAction(
  name: string,
  ids: string[],
  action: "retry" | "remove" | "promote",
): number {
  const q = world.find((x) => x.name === name);
  if (!q) return 0;
  const idset = new Set(ids);
  let affected = 0;

  if (action === "remove") {
    const before = q.jobs.length;
    q.jobs = q.jobs.filter((j) => {
      if (!idset.has(j.id)) return true;
      q.counts[j.state] = Math.max(0, q.counts[j.state] - 1);
      return false;
    });
    return before - q.jobs.length;
  }

  for (const j of q.jobs) {
    if (!idset.has(j.id)) continue;
    if (action === "retry" && j.state === "failed") {
      q.counts.failed = Math.max(0, q.counts.failed - 1);
      j.state = "waiting";
      j.attemptsMade = 0;
      delete j.failedReason;
      delete j.stacktrace;
      q.counts.waiting += 1;
      affected++;
    } else if (action === "promote" && j.state === "delayed") {
      q.counts.delayed = Math.max(0, q.counts.delayed - 1);
      j.state = "waiting";
      delete j.delayUntil;
      q.counts.waiting += 1;
      affected++;
    }
  }
  return affected;
}

export function getQueues(): QueueSummary[] {
  return world.map((q) => {
    const completedWindow = q.throughput.reduce((a, b) => a + b, 0);
    const failedWindow = q.failures.reduce((a, b) => a + b, 0);
    return {
      name: q.name,
      paused: q.paused,
      counts: { ...q.counts },
      throughput: [...q.throughput],
      failures: [...q.failures],
      ratePerMin: q.throughput[q.throughput.length - 1] ?? 0,
      failRate: completedWindow + failedWindow === 0 ? 0 : failedWindow / (completedWindow + failedWindow),
    };
  });
}

export function getQueue(name: string): QueueSummary | undefined {
  return getQueues().find((q) => q.name === name);
}

export function getJobs(name: string, state: JobState): Job[] {
  const q = world.find((x) => x.name === name);
  if (!q) return [];
  return q.jobs.filter((j) => j.state === state);
}
