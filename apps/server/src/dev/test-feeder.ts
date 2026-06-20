// Dev-only simulated traffic. The "magic-number" queue only passes payload { value: 1 },
// so you can exercise the edit-payload-and-retry flow. Run: bun run feed
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const PREFIX = process.env.BULLMQ_PREFIX ?? "bull";

interface Scenario {
  queue: string;
  job: string;
  failRate: number;
  minMs: number;
  maxMs: number;
  gapMin: number;
  gapMax: number;
  payload: (n: number) => unknown;
  errors: string[];
  gate?: (data: unknown) => string | null;
}

const SCENARIOS: Scenario[] = [
  {
    queue: "emails",
    job: "send-email",
    failRate: 0.12,
    minMs: 30,
    maxMs: 180,
    gapMin: 1200,
    gapMax: 2600,
    payload: (n) => ({
      to: `user${n}@acme.io`,
      template: pick(["welcome", "receipt", "password-reset"]),
      messageId: `msg_${n}`,
    }),
    errors: [
      "SMTP 550: mailbox unavailable",
      "SES throttled: rate exceeded",
      "DNS lookup failed for mx.acme.io",
    ],
  },
  {
    queue: "payments",
    job: "charge-card",
    failRate: 0.26,
    minMs: 80,
    maxMs: 420,
    gapMin: 1600,
    gapMax: 3200,
    payload: (n) => ({
      customer: `cus_${1000 + n}`,
      amount: 500 + (n % 60) * 100,
      currency: "USD",
    }),
    errors: [
      "card_declined: insufficient_funds",
      "Stripe gateway timeout after 8s",
      "3DS authentication required",
    ],
  },
  {
    queue: "image-processing",
    job: "resize",
    failRate: 0.08,
    minMs: 120,
    maxMs: 650,
    gapMin: 2000,
    gapMax: 4000,
    payload: (n) => ({ src: `s3://uploads/${n}.png`, sizes: ["thumb", "md", "lg"] }),
    errors: [
      "unsupported format: image/heic",
      "source object not found in bucket",
      "OOM while decoding 8000x8000",
    ],
  },
  {
    queue: "webhooks",
    job: "deliver",
    failRate: 0.32,
    minMs: 40,
    maxMs: 260,
    gapMin: 1500,
    gapMax: 3000,
    payload: (n) => ({
      url: `https://hooks.partner${n % 7}.io/in`,
      event: pick(["order.created", "order.paid", "refund.issued"]),
    }),
    errors: ["connect ECONNREFUSED", "remote returned HTTP 500", "TLS handshake timeout"],
  },
  {
    queue: "notifications",
    job: "push",
    failRate: 0.1,
    minMs: 20,
    maxMs: 90,
    gapMin: 1800,
    gapMax: 3600,
    payload: (n) => ({ device: `dev_${n}`, title: "You have a new message" }),
    errors: ["APNs: BadDeviceToken", "FCM: registration-token-not-registered"],
  },
  {
    queue: "magic-number",
    job: "guess",
    failRate: 0,
    minMs: 30,
    maxMs: 120,
    gapMin: 3000,
    gapMax: 5000,
    payload: () => ({ value: jitter(0, 10) }),
    errors: [],
    gate: (data) => {
      const value = (data as { value?: unknown }).value;
      const passes = value === 1 || value === "1" || value === "um";
      return passes ? null : `rejected: set "value" to 1 to pass (got ${JSON.stringify(value)})`;
    },
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const queues = new Map<string, Queue>();
const workers: Worker[] = [];

for (const s of SCENARIOS) {
  queues.set(s.queue, new Queue(s.queue, { connection: redis, prefix: PREFIX }));
  workers.push(
    new Worker(
      s.queue,
      async (job) => {
        await sleep(jitter(s.minMs, s.maxMs));
        if (s.gate) {
          const rejection = s.gate(job.data);
          if (rejection) throw new Error(rejection);
          return { ok: true, value: (job.data as { value?: unknown }).value };
        }
        if (Math.random() < s.failRate) throw new Error(pick(s.errors));
        return { ok: true, finishedAt: new Date().toISOString() };
      },
      { connection: redis.duplicate(), prefix: PREFIX, concurrency: 4 },
    ),
  );
}

await Promise.all([...queues.values()].map((q) => q.waitUntilReady()));

let running = true;
let produced = 0;

async function shutdown() {
  if (!running) return;
  running = false;
  console.log("\n[test-feeder] stopping…");
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([...queues.values()].map((q) => q.close()));
  await redis.quit();
  console.log(`[test-feeder] done — published ${produced} jobs this session`);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function feed(s: Scenario) {
  const queue = queues.get(s.queue);
  if (!queue) return;
  while (running) {
    const n = produced++;
    await queue.add(s.job, s.payload(n), {
      attempts: s.gate ? 1 : Math.random() < 0.5 ? 2 : 1,
      backoff: { type: "fixed", delay: 500 },
      priority: pick([1, 1, 1, 2, 3]),
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 200 },
    });
    await sleep(jitter(s.gapMin, s.gapMax));
  }
}

console.log(
  `\n┌─ TEST FEEDER · simulated traffic (NOT production) ──────────────\n` +
    `│ redis ${REDIS_URL}  prefix "${PREFIX}"\n` +
    `│ queues: ${SCENARIOS.map((s) => s.queue).join(", ")}\n` +
    `│ a few real BullMQ jobs per queue, some failing on purpose.\n` +
    `│ "magic-number" fails unless value=1 — edit a failed job's payload to retry.\n` +
    `│ Ctrl-C to stop.\n` +
    `└────────────────────────────────────────────────────────────────\n`,
);

await Promise.all(SCENARIOS.map(feed));
