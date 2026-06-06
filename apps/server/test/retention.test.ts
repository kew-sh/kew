import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  type RetainedJob,
  type RetentionHandle,
  type RetentionSink,
  startRetention,
} from "@kew/core/server";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";
const PREFIX = process.env.BULLMQ_PREFIX ?? "bull";
const QUEUE = `kew-retention-${crypto.randomUUID().slice(0, 8)}`;

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

async function poll<T>(fn: () => T, ok: (v: T) => boolean, timeoutMs = 10_000): Promise<T> {
  const start = Date.now();
  let value = fn();
  while (!ok(value) && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
    value = fn();
  }
  return value;
}

describe("retention collector", () => {
  test("captures terminal jobs with original payload despite removeOnComplete/Fail", async () => {
    const captured: RetainedJob[] = [];
    const sink: RetentionSink = {
      write: (records) => {
        captured.push(...records);
      },
    };

    const worker = new Worker(
      QUEUE,
      async (job) => {
        await new Promise((r) => setTimeout(r, 20));
        const data = job.data as { tag: string; fail?: boolean };
        if (data.fail) throw new Error(`boom ${data.tag}`);
        return { echoed: data.tag };
      },
      { connection: redis.duplicate(), prefix: PREFIX, concurrency: 1 },
    );

    let collector: RetentionHandle | undefined;
    try {
      const ghostDone = new Promise<void>((resolve) => worker.once("completed", () => resolve()));
      await queue.add("ghost", { tag: "ghost" }, { removeOnComplete: true, removeOnFail: true });
      await ghostDone;

      collector = startRetention(redis, async () => [QUEUE], sink, {
        flushIntervalMs: 50,
        discoverIntervalMs: 100,
      });
      await collector.whenReady();
      await new Promise((r) => setTimeout(r, 200));

      await queue.add("ok-job", { tag: "alpha", fail: false }, { removeOnComplete: true });
      await queue.add("bad-job", { tag: "beta", fail: true }, { removeOnFail: true, attempts: 1 });

      const seen = await poll(
        () => captured,
        (c) => c.some((r) => r.state === "completed") && c.some((r) => r.state === "failed"),
        15_000,
      );

      const ok = seen.find((r) => r.state === "completed");
      expect(ok).toBeDefined();
      expect(ok?.name).toBe("ok-job");
      expect(ok?.payloadCaptured).toBe(true);
      expect(ok?.data).toEqual({ tag: "alpha", fail: false });
      expect(ok?.returnValue).toEqual({ echoed: "alpha" });

      const bad = seen.find((r) => r.state === "failed");
      expect(bad).toBeDefined();
      expect(bad?.name).toBe("bad-job");
      expect(bad?.payloadCaptured).toBe(true);
      expect(bad?.data).toEqual({ tag: "beta", fail: true });
      expect(bad?.failedReason).toContain("boom");

      expect(seen.some((r) => r.name === "ghost")).toBe(false);
    } finally {
      await collector?.stop();
      await worker.close();
    }
  }, 30_000);
});
