import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BulkAction, JobState, SchedulerInput } from "@kew/core/types";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import {
  applyBulk,
  discoverQueues,
  getJobsPage,
  getQueueSummary,
  listFlows,
  listSchedulers,
  removeScheduler,
  retryWithData,
  STATES,
  setQueuePaused,
  upsertScheduler,
} from "./queue-service";
import { createRedis, REDIS_URL } from "./redis";
import { startSampler } from "./sampler";

const redis = createRedis();
const READ_ONLY = process.env.READ_ONLY === "1";
const PORT = Number(process.env.PORT ?? 3000);

startSampler(redis, () => discoverQueues(redis));

const app = new Hono();
app.use("/api/*", cors());

app.get("/api/connection", async (c) => {
  try {
    const info = await redis.info("server");
    const version = /redis_version:([^\r\n]+)/.exec(info)?.[1] ?? "unknown";
    return c.json({
      url: REDIS_URL,
      status: "connected",
      readOnly: READ_ONLY,
      redisVersion: version,
    });
  } catch {
    return c.json({
      url: REDIS_URL,
      status: "error",
      readOnly: READ_ONLY,
      redisVersion: "unknown",
    });
  }
});

app.get("/api/queues", async (c) => {
  const names = await discoverQueues(redis);
  const summaries = await Promise.all(names.map((n) => getQueueSummary(n, redis)));
  return c.json(summaries);
});

app.get("/api/queues/:name", async (c) => {
  return c.json(await getQueueSummary(c.req.param("name"), redis));
});

app.post("/api/queues/:name/pause", async (c) => {
  if (READ_ONLY) return c.json({ error: "read-only" }, 403);
  await setQueuePaused(c.req.param("name"), true, redis);
  return c.body(null, 204);
});

app.post("/api/queues/:name/resume", async (c) => {
  if (READ_ONLY) return c.json({ error: "read-only" }, 403);
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
  return c.json(await getJobsPage(name, state, page, pageSize, search, redis));
});

app.post("/api/queues/:name/jobs/bulk", async (c) => {
  if (READ_ONLY) return c.json({ error: "read-only" }, 403);
  const { ids, action } = await c.req.json<{ ids: string[]; action: BulkAction }>();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: "ids required" }, 400);
  return c.json(await applyBulk(c.req.param("name"), ids, action, redis));
});

app.post("/api/queues/:name/jobs/:id/retry-with-data", async (c) => {
  if (READ_ONLY) return c.json({ error: "read-only" }, 403);
  const { data } = await c.req.json<{ data: unknown }>();
  await retryWithData(c.req.param("name"), c.req.param("id"), data, redis);
  return c.body(null, 204);
});

app.get("/api/queues/:name/schedulers", async (c) =>
  c.json(await listSchedulers(c.req.param("name"), redis)),
);

app.post("/api/queues/:name/schedulers", async (c) => {
  if (READ_ONLY) return c.json({ error: "read-only" }, 403);
  const body = await c.req.json<SchedulerInput>();
  if (!body.pattern && !body.every) return c.json({ error: "pattern or every required" }, 400);
  await upsertScheduler({ ...body, queue: c.req.param("name") }, redis);
  return c.body(null, 204);
});

app.delete("/api/queues/:name/schedulers/:id", async (c) => {
  if (READ_ONLY) return c.json({ error: "read-only" }, 403);
  await removeScheduler(c.req.param("name"), c.req.param("id"), redis);
  return c.body(null, 204);
});

app.get("/api/flows", async (c) => c.json(await listFlows(redis)));

const dist = fileURLToPath(new URL("../../dashboard/dist", import.meta.url));
if (existsSync(dist)) {
  app.use("/assets/*", serveStatic({ root: dist }));
  app.get("/*", serveStatic({ path: "index.html", root: dist }));
}

console.log(`queue-panel server → http://localhost:${PORT}  (redis: ${REDIS_URL})`);

export default { port: PORT, fetch: app.fetch };
