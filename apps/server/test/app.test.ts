import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Queue, Worker } from "bullmq";
import type { MiddlewareHandler } from "hono";
import { Redis } from "ioredis";
import { type AppDeps, type AuthDeps, createApp } from "../src/app";
import type { RetainedJob } from "../src/queue";
import { createSqliteRetention, type RetentionStore } from "../src/retention-store";

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";
const PREFIX = process.env.BULLMQ_PREFIX ?? "bull";
const QUEUE = `kew-app-${crypto.randomUUID().slice(0, 8)}`;

const stubVersion = async () => ({ current: "test", updateAvailable: false });

const openAuth: AuthDeps = {
  requireAuth: (async (_c, next) => next()) as MiddlewareHandler,
  me: (c) => c.json({}),
  login: (c) => c.body(null, 204),
  logout: (c) => c.body(null, 204),
};

let redis: Redis;
let queue: Queue;
let store: RetentionStore;
let app: ReturnType<typeof createApp>;
let roApp: ReturnType<typeof createApp>;

function post(target: ReturnType<typeof createApp>, path: string, body?: unknown) {
  return target.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function poll<T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  const start = Date.now();
  let value = await fn();
  while (!ok(value) && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
    value = await fn();
  }
  return value;
}

beforeAll(async () => {
  redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: null });
  queue = new Queue(QUEUE, { connection: redis, prefix: PREFIX });
  await queue.waitUntilReady();

  store = createSqliteRetention({ path: ":memory:" });

  const base: Omit<AppDeps, "readOnly"> = {
    redis,
    retentionStore: store,
    getVersion: stubVersion,
    auth: openAuth,
  };
  app = createApp({ ...base, readOnly: false });
  roApp = createApp({ ...base, readOnly: true });
});

afterAll(async () => {
  await queue.obliterate({ force: true }).catch(() => {});
  await queue.close();
  store.close();
  await redis.quit();
});

describe("meta endpoints", () => {
  test("GET /healthz reports redis status", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", redis: "connected" });
  });

  test("GET /api/version returns the injected version", async () => {
    expect(await (await app.request("/api/version")).json()).toEqual({
      current: "test",
      updateAvailable: false,
    });
  });

  test("GET /api/connection reports a connected, writable instance", async () => {
    const conn = await (await app.request("/api/connection")).json();
    expect(conn).toMatchObject({ status: "connected", readOnly: false });
    expect(typeof conn.url).toBe("string");
  });
});

describe("queues & jobs", () => {
  test("GET /api/queues discovers the queue and GET /api/queues/:name summarizes it", async () => {
    await queue.add("greet", { hi: 1 });
    const names = (await (await app.request("/api/queues")).json()).map(
      (q: { name: string }) => q.name,
    );
    expect(names).toContain(QUEUE);

    const summary = await (await app.request(`/api/queues/${QUEUE}`)).json();
    expect(summary.name).toBe(QUEUE);
    expect(summary.counts.waiting).toBeGreaterThanOrEqual(1);
  });

  test("GET /api/queues/:name/jobs lists jobs for a state", async () => {
    await queue.drain(true);
    await queue.add("a", { n: 1 });
    const page = await (await app.request(`/api/queues/${QUEUE}/jobs?state=waiting`)).json();
    expect(page.jobs.length).toBe(1);
    expect(page.jobs[0].name).toBe("a");
  });

  test("GET /api/queues/:name/jobs rejects an unknown state", async () => {
    const res = await app.request(`/api/queues/${QUEUE}/jobs?state=bogus`);
    expect(res.status).toBe(400);
  });

  test("pause then resume flips the queue", async () => {
    expect((await post(app, `/api/queues/${QUEUE}/pause`)).status).toBe(204);
    expect(await queue.isPaused()).toBe(true);
    expect((await post(app, `/api/queues/${QUEUE}/resume`)).status).toBe(204);
    expect(await queue.isPaused()).toBe(false);
  });

  test("bulk remove deletes the given jobs", async () => {
    await queue.drain(true);
    const j1 = await queue.add("x", { k: 1 });
    const j2 = await queue.add("y", { k: 2 });
    const res = await post(app, `/api/queues/${QUEUE}/jobs/bulk`, {
      ids: [String(j1.id), String(j2.id)],
      action: "remove",
    });
    expect((await res.json()).affected).toBe(2);
  });

  test("bulk rejects a malformed body", async () => {
    expect((await post(app, `/api/queues/${QUEUE}/jobs/bulk`, {})).status).toBe(400);
  });

  test("retry-with-data re-runs a failed job with the edited payload", async () => {
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
      await poll(
        () => queue.getJobCounts("failed"),
        (c) => (c.failed ?? 0) >= 1,
      );

      const res = await post(app, `/api/queues/${QUEUE}/jobs/${id}/retry-with-data`, {
        data: { fail: false },
      });
      expect(res.status).toBe(204);

      const done = await poll(
        () => queue.getJobCounts("completed"),
        (c) => (c.completed ?? 0) >= 1,
      );
      expect(done.completed).toBeGreaterThanOrEqual(1);
    } finally {
      await worker.close();
    }
  }, 20_000);

  test("retry-with-data rejects a malformed body", async () => {
    const res = await post(app, `/api/queues/${QUEUE}/jobs/1/retry-with-data`, undefined);
    expect(res.status).toBe(400);
  });
});

describe("schedulers", () => {
  test("upsert, list, then remove a scheduler", async () => {
    expect(
      (
        await post(app, `/api/queues/${QUEUE}/schedulers`, {
          id: "nightly",
          name: "report",
          pattern: "0 0 * * *",
          tz: "UTC",
        })
      ).status,
    ).toBe(204);

    const list = await (await app.request(`/api/queues/${QUEUE}/schedulers`)).json();
    expect(list.find((s: { id: string }) => s.id === "nightly")).toBeDefined();

    const del = await app.request(`/api/queues/${QUEUE}/schedulers/nightly`, { method: "DELETE" });
    expect(del.status).toBe(204);
  });

  test("upsert rejects a scheduler with neither pattern nor interval", async () => {
    expect((await post(app, `/api/queues/${QUEUE}/schedulers`, { id: "x" })).status).toBe(400);
  });
});

describe("retention-backed endpoints", () => {
  test("GET /api/history returns retained records", async () => {
    const rec: RetainedJob = {
      queue: QUEUE,
      jobId: "hist-1",
      name: "old",
      state: "completed",
      data: { kind: "report" },
      opts: {},
      capturedAt: Date.now(),
      payloadCaptured: true,
    };
    store.sink.write([rec]);
    const page = await (await app.request(`/api/history?queue=${QUEUE}`)).json();
    expect(page.jobs.some((j: { id: string }) => j.id === "hist-1")).toBe(true);
  });

  test("rerun re-enqueues a retained job with the edited payload", async () => {
    store.sink.write([
      {
        queue: QUEUE,
        jobId: "ret-1",
        name: "task",
        state: "completed",
        data: { a: 1 },
        opts: {},
        capturedAt: Date.now(),
        payloadCaptured: true,
      },
    ]);
    const res = await post(app, `/api/queues/${QUEUE}/jobs/ret-1/rerun`, { data: { a: 2 } });
    expect(res.status).toBe(200);
    const { id } = await res.json();
    expect(await queue.getJob(id).then((j) => j?.data)).toEqual({ a: 2 });
  });

  test("rerun of a missing retained job is a 404", async () => {
    expect((await post(app, `/api/queues/${QUEUE}/jobs/nope/rerun`)).status).toBe(404);
  });

  test("GET /api/flows returns an array", async () => {
    const res = await app.request("/api/flows");
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});

describe("read-only mode blocks every mutation", () => {
  test("pause, bulk, retry-with-data, rerun, and scheduler writes all return 403", async () => {
    expect((await post(roApp, `/api/queues/${QUEUE}/pause`)).status).toBe(403);
    expect(
      (await post(roApp, `/api/queues/${QUEUE}/jobs/bulk`, { ids: ["1"], action: "remove" }))
        .status,
    ).toBe(403);
    expect(
      (await post(roApp, `/api/queues/${QUEUE}/jobs/1/retry-with-data`, { data: {} })).status,
    ).toBe(403);
    expect((await post(roApp, `/api/queues/${QUEUE}/jobs/ret-1/rerun`, { data: {} })).status).toBe(
      403,
    );
    expect(
      (await post(roApp, `/api/queues/${QUEUE}/schedulers`, { id: "x", pattern: "* * * * *" }))
        .status,
    ).toBe(403);
    expect(
      (await roApp.request(`/api/queues/${QUEUE}/schedulers/x`, { method: "DELETE" })).status,
    ).toBe(403);
  });

  test("reads still work in read-only mode", async () => {
    expect((await roApp.request(`/api/queues/${QUEUE}`)).status).toBe(200);
  });
});
