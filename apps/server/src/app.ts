import type { Handler, MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Redis } from "ioredis";
import { z } from "zod";
import { mergeCounts, mergeJobPages } from "./merge-jobs";
import {
  applyBulk,
  discoverQueues,
  getJobsPage,
  getQueue,
  getQueueSummary,
  listFlows,
  listSchedulers,
  REDIS_URL,
  redactRedisUrl,
  redisStatus,
  removeScheduler,
  retryWithData,
  STATES,
  setQueuePaused,
  upsertScheduler,
} from "./queue";
import type { RetentionStore } from "./retention-store";
import type { JobState, VersionInfo } from "./types";

export interface AuthDeps {
  requireAuth: MiddlewareHandler;
  me: Handler;
  login: Handler;
  logout: Handler;
}

export interface AppDeps {
  redis: Redis;
  auth: AuthDeps;
  getVersion: () => Promise<VersionInfo>;
  retentionStore?: RetentionStore;
  readOnly?: boolean;
  redisUrl?: string;
}

const MERGE_FETCH_CAP = 1000;
const COUNT_ID_CAP = 500;
const RERUN_STRIP_OPTS = new Set([
  "jobId",
  "repeat",
  "delay",
  "parent",
  "deduplication",
  "fpof",
  "rdof",
  "idof",
  "ovrd",
]);

const bulkSchema = z.object({
  ids: z.array(z.string().min(1).max(256)).min(1).max(1000),
  action: z.enum(["retry", "remove", "promote"]),
});

const schedulerSchema = z
  .object({
    id: z.string().min(1).max(256),
    name: z.string().min(1).max(256).optional(),
    pattern: z.string().max(256).optional(),
    every: z.number().int().positive().optional(),
    tz: z.string().max(64).optional(),
    data: z.unknown().optional(),
  })
  .refine((v) => Boolean(v.pattern) || typeof v.every === "number", {
    message: "pattern or every required",
  });

const retryWithDataSchema = z.object({ data: z.unknown() });

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function sanitizeRerunOpts(opts: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(opts)) {
    if (!RERUN_STRIP_OPTS.has(key)) clean[key] = value;
  }

  return clean;
}

export function createApp(deps: AppDeps): Hono {
  const { redis, auth, getVersion, retentionStore, readOnly = false, redisUrl = REDIS_URL } = deps;

  const requireRedis: MiddlewareHandler = async (c, next) => {
    if (redisStatus(redis) !== "connected") return c.json({ error: "redis unavailable" }, 503);

    await next();
  };

  async function liveStateIds(name: string, state: "completed" | "failed"): Promise<string[]> {
    const jobs = await getQueue(name, redis).getJobs([state], 0, COUNT_ID_CAP - 1, false);

    return jobs.map((j) => String(j.id));
  }

  async function summaryWithRetention(name: string) {
    const summary = await getQueueSummary(name, redis);

    if (!retentionStore) return summary;

    const store = retentionStore;
    const retained = store.counts(name);
    const [completedIds, failedIds] = await Promise.all([
      liveStateIds(name, "completed"),
      liveStateIds(name, "failed"),
    ]);
    const overlap = {
      completed: store.countOverlap(name, "completed", completedIds),
      failed: store.countOverlap(name, "failed", failedIds),
    };

    return { ...summary, counts: mergeCounts(summary.counts, retained, overlap) };
  }

  const app = new Hono();

  app.use("/api/*", cors());
  app.use("/api/*", auth.requireAuth);

  app.get("/api/auth/me", auth.me);
  app.post("/api/auth/login", auth.login);
  app.post("/api/auth/logout", auth.logout);

  app.get("/healthz", (c) => c.json({ status: "ok", redis: redisStatus(redis) }));

  app.get("/api/connection", async (c) => {
    const status = redisStatus(redis);
    let redisVersion = "unknown";

    if (status === "connected") {
      try {
        const info = await withTimeout(redis.info("server"), 1500);
        redisVersion = /redis_version:([^\r\n]+)/.exec(info)?.[1] ?? "unknown";
      } catch {
        redisVersion = "unknown";
      }
    }

    return c.json({ url: redactRedisUrl(redisUrl), status, readOnly, redisVersion });
  });

  app.get("/api/version", async (c) => c.json(await getVersion()));

  app.get("/api/history", (c) => {
    if (!retentionStore) return c.json({ jobs: [], total: 0, exact: true });

    const stateRaw = c.req.query("state");

    return c.json(
      retentionStore.query({
        queue: c.req.query("queue") || undefined,
        state: stateRaw === "completed" || stateRaw === "failed" ? stateRaw : undefined,
        from: Number(c.req.query("from")) || undefined,
        to: Number(c.req.query("to")) || undefined,
        search: c.req.query("search") || undefined,
        page: Math.max(0, Number(c.req.query("page") ?? 0)),
        pageSize: Math.min(200, Math.max(1, Number(c.req.query("pageSize") ?? 50))),
      }),
    );
  });

  app.use("/api/queues", requireRedis);
  app.use("/api/queues/*", requireRedis);
  app.use("/api/flows", requireRedis);

  app.get("/api/queues", async (c) => {
    const names = await discoverQueues(redis);
    const summaries = await Promise.all(names.map((n) => summaryWithRetention(n)));

    return c.json(summaries);
  });

  app.get("/api/queues/:name", async (c) => {
    return c.json(await summaryWithRetention(c.req.param("name")));
  });

  app.post("/api/queues/:name/pause", async (c) => {
    if (readOnly) return c.json({ error: "read-only" }, 403);

    await setQueuePaused(c.req.param("name"), true, redis);

    return c.body(null, 204);
  });

  app.post("/api/queues/:name/resume", async (c) => {
    if (readOnly) return c.json({ error: "read-only" }, 403);

    await setQueuePaused(c.req.param("name"), false, redis);

    return c.body(null, 204);
  });

  app.get("/api/queues/:name/jobs", async (c) => {
    const name = c.req.param("name");
    const state = (c.req.query("state") ?? "failed") as JobState;

    if (!STATES.includes(state)) return c.json({ error: "invalid state" }, 400);

    const page = Math.max(0, Number(c.req.query("page") ?? 0));
    const pageSize = Math.min(200, Math.max(1, Number(c.req.query("pageSize") ?? 50)));
    const search = c.req.query("search") || undefined;

    if (!retentionStore || (state !== "completed" && state !== "failed")) {
      return c.json(await getJobsPage(name, state, page, pageSize, search, redis));
    }

    const fetchSize = Math.min(MERGE_FETCH_CAP, (page + 1) * pageSize);
    const [live, retained] = await Promise.all([
      getJobsPage(name, state, 0, fetchSize, search, redis),
      Promise.resolve(
        retentionStore.query({ queue: name, state, search, page: 0, pageSize: fetchSize }),
      ),
    ]);

    return c.json(mergeJobPages(live, retained, page, pageSize));
  });

  app.post("/api/queues/:name/jobs/bulk", async (c) => {
    if (readOnly) return c.json({ error: "read-only" }, 403);

    const parsed = bulkSchema.safeParse(await c.req.json().catch(() => ({})));

    if (!parsed.success) return c.json({ error: "invalid bulk request" }, 400);

    const name = c.req.param("name");
    const { ids, action } = parsed.data;
    const result = await applyBulk(name, ids, action, redis);

    if (action === "remove" && retentionStore) {
      const removed = retentionStore.remove(name, ids);

      return c.json({ affected: Math.max(result.affected, removed) });
    }

    return c.json(result);
  });

  app.post("/api/queues/:name/jobs/:id/retry-with-data", async (c) => {
    if (readOnly) return c.json({ error: "read-only" }, 403);

    const parsed = retryWithDataSchema.safeParse(await c.req.json().catch(() => undefined));

    if (!parsed.success) return c.json({ error: "invalid request" }, 400);

    await retryWithData(c.req.param("name"), c.req.param("id"), parsed.data.data, redis);

    return c.body(null, 204);
  });

  app.post("/api/queues/:name/jobs/:id/rerun", async (c) => {
    if (readOnly) return c.json({ error: "read-only" }, 403);
    if (!retentionStore) return c.json({ error: "retention disabled" }, 404);

    const name = c.req.param("name");
    const job = retentionStore.get(name, c.req.param("id"));

    if (!job) return c.json({ error: "not found" }, 404);

    const body = (await c.req.json().catch(() => null)) as { data?: unknown } | null;
    const data = body && "data" in body ? body.data : job.data;
    const added = await getQueue(name, redis).add(job.name, data, sanitizeRerunOpts(job.opts));

    return c.json({ id: String(added.id) });
  });

  app.get("/api/queues/:name/schedulers", async (c) =>
    c.json(await listSchedulers(c.req.param("name"), redis)),
  );

  app.post("/api/queues/:name/schedulers", async (c) => {
    if (readOnly) return c.json({ error: "read-only" }, 403);

    const parsed = schedulerSchema.safeParse(await c.req.json().catch(() => ({})));

    if (!parsed.success) return c.json({ error: "invalid scheduler" }, 400);

    const { name } = parsed.data;

    await upsertScheduler(
      { ...parsed.data, name: name ?? parsed.data.id, queue: c.req.param("name") },
      redis,
    );

    return c.body(null, 204);
  });

  app.delete("/api/queues/:name/schedulers/:id", async (c) => {
    if (readOnly) return c.json({ error: "read-only" }, 403);

    await removeScheduler(c.req.param("name"), c.req.param("id"), redis);

    return c.body(null, 204);
  });

  app.get("/api/flows", async (c) => c.json(await listFlows(redis)));

  return app;
}
