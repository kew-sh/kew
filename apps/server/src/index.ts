import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { JobState } from "@kew/core/types";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { discoverQueues, getJobsPage, getQueueSummary, STATES } from "./queue-service";
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

app.get("/api/queues/:name/jobs", async (c) => {
  const name = c.req.param("name");
  const state = (c.req.query("state") ?? "failed") as JobState;
  if (!STATES.includes(state)) return c.json({ error: "invalid state" }, 400);
  const page = Math.max(0, Number(c.req.query("page") ?? 0));
  const pageSize = Math.min(200, Math.max(1, Number(c.req.query("pageSize") ?? 50)));
  const search = c.req.query("search") || undefined;
  return c.json(await getJobsPage(name, state, page, pageSize, search, redis));
});

// In production, serve the built dashboard SPA so this is one standalone artifact.
const dist = fileURLToPath(new URL("../../dashboard/dist", import.meta.url));
if (existsSync(dist)) {
  app.use("/assets/*", serveStatic({ root: dist }));
  app.get("/*", serveStatic({ path: "index.html", root: dist }));
}

console.log(`queue-panel server → http://localhost:${PORT}  (redis: ${REDIS_URL})`);

export default { port: PORT, fetch: app.fetch };
