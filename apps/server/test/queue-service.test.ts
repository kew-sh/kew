import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  applyBulk,
  discoverQueues,
  getJobsPage,
  getQueueSummary,
  listSchedulers,
  removeScheduler,
  retryWithData,
  setQueuePaused,
  upsertScheduler,
} from "@kew/core/server";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";
const PREFIX = process.env.BULLMQ_PREFIX ?? "bull";
const QUEUE = `kew-test-${crypto.randomUUID().slice(0, 8)}`;

let redis: Redis;
let queue: Queue;

beforeAll(async () => {
  redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: null });
  queue = new Queue(QUEUE, { connection: redis, prefix: PREFIX });
  await queue.waitUntilReady();
});

afterAll(async () => {
  await queue.obliterate({ force: true }).catch(() => {});
  await queue.close();
  await redis.quit();
});

async function poll<T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  const start = Date.now();
  let value = await fn();
  while (!ok(value) && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 150));
    value = await fn();
  }
  return value;
}

describe("discovery & counts", () => {
  test("discoverQueues finds the queue", async () => {
    await queue.add("greet", { hello: "world" });
    expect(await discoverQueues(redis)).toContain(QUEUE);
  });

  test("getQueueSummary reports waiting and delayed counts", async () => {
    await queue.drain(true);
    await queue.add("a", { n: 1 });
    await queue.add("b", { n: 2 });
    await queue.add("later", { n: 3 }, { delay: 60_000 });
    const summary = await getQueueSummary(QUEUE, redis);
    expect(summary.counts.waiting).toBe(2);
    expect(summary.counts.delayed).toBe(1);
    expect(summary.paused).toBe(false);
  });
});

describe("jobs page", () => {
  test("paginates and filters by search term", async () => {
    await queue.drain(true);
    await queue.add("email-job", { to: "alice@example.com" });
    await queue.add("sms-job", { to: "+15550001111" });

    const all = await getJobsPage(QUEUE, "waiting", 0, 50, undefined, redis);
    expect(all.jobs.length).toBe(2);
    expect(all.exact).toBe(true);

    const hit = await getJobsPage(QUEUE, "waiting", 0, 50, "alice", redis);
    expect(hit.jobs.length).toBe(1);
    expect(hit.exact).toBe(false);
    expect(hit.jobs[0].name).toBe("email-job");
  });
});

describe("queue actions", () => {
  test("setQueuePaused pauses and resumes", async () => {
    await setQueuePaused(QUEUE, true, redis);
    expect(await queue.isPaused()).toBe(true);
    expect((await getQueueSummary(QUEUE, redis)).paused).toBe(true);
    await setQueuePaused(QUEUE, false, redis);
    expect(await queue.isPaused()).toBe(false);
  });

  test("applyBulk removes waiting jobs", async () => {
    await queue.drain(true);
    const j1 = await queue.add("x", { k: 1 });
    const j2 = await queue.add("y", { k: 2 });
    const res = await applyBulk(QUEUE, [String(j1.id), String(j2.id)], "remove", redis);
    expect(res.affected).toBe(2);
    expect((await getQueueSummary(QUEUE, redis)).counts.waiting).toBe(0);
  });

  test("applyBulk promotes delayed jobs to waiting", async () => {
    await queue.drain(true);
    const d = await queue.add("soon", { k: 1 }, { delay: 60_000 });
    const res = await applyBulk(QUEUE, [String(d.id)], "promote", redis);
    expect(res.affected).toBe(1);
    const s = await getQueueSummary(QUEUE, redis);
    expect(s.counts.delayed).toBe(0);
    expect(s.counts.waiting).toBe(1);
  });
});

describe("schedulers", () => {
  test("upsert, list, remove", async () => {
    await upsertScheduler(
      {
        queue: QUEUE,
        id: "nightly",
        name: "report",
        pattern: "0 0 * * *",
        tz: "UTC",
        data: { kind: "report" },
      },
      redis,
    );
    const present = await listSchedulers(QUEUE, redis);
    const found = present.find((s) => s.id === "nightly");
    expect(found).toBeDefined();
    expect(found?.pattern).toBe("0 0 * * *");

    await removeScheduler(QUEUE, "nightly", redis);
    const after = await listSchedulers(QUEUE, redis);
    expect(after.find((s) => s.id === "nightly")).toBeUndefined();
  });
});

describe("retry with edited payload", () => {
  test("a failed job is retried with new data and runs to completion", async () => {
    await queue.drain(true);
    const worker = new Worker(
      QUEUE,
      async (job) => {
        if ((job.data as { fail?: boolean }).fail) throw new Error("boom");
        return { ok: true };
      },
      { connection: redis.duplicate(), prefix: PREFIX },
    );
    try {
      const job = await queue.add("task", { fail: true }, { attempts: 1 });
      const id = String(job.id);

      const failed = await poll(
        () => getQueueSummary(QUEUE, redis),
        (s) => s.counts.failed >= 1,
      );
      expect(failed.counts.failed).toBe(1);

      await retryWithData(QUEUE, id, { fail: false }, redis);

      const done = await poll(
        () => getQueueSummary(QUEUE, redis),
        (s) => s.counts.completed >= 1,
      );
      expect(done.counts.completed).toBe(1);
      expect((await queue.getJob(id))?.data).toEqual({ fail: false });
    } finally {
      await worker.close();
    }
  }, 20_000);
});
