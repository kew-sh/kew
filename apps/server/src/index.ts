import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serveStatic } from "hono/bun";
import { createApp } from "./app";
import { AUTH_MODE, handleLogin, handleLogout, handleMe, requireAuth } from "./auth";
import { env } from "./env";
import {
  createRedis,
  discoverQueues,
  REDIS_URL,
  type RetentionHandle,
  redactRedisUrl,
  startRetention,
  startSampler,
} from "./queue";
import { createSqliteRetention, type RetentionStore } from "./retention-store";
import { getVersionInfo } from "./version";

const redis = createRedis();
const { READ_ONLY, PORT, HOST } = env;

let retention: RetentionHandle | undefined;
let retentionStore: RetentionStore | undefined;

if (env.KEW_RETENTION) {
  retentionStore = createSqliteRetention({
    path: env.KEW_RETENTION_DB_PATH,
    migrate: false,
    maxAgeMs:
      env.KEW_RETENTION_MAX_AGE_DAYS > 0 ? env.KEW_RETENTION_MAX_AGE_DAYS * 86_400_000 : undefined,
    maxRows: env.KEW_RETENTION_MAX_ROWS > 0 ? env.KEW_RETENTION_MAX_ROWS : undefined,
  });
  retention = startRetention(redis, () => discoverQueues(redis), retentionStore.sink);
}

if (HOST !== "127.0.0.1" && HOST !== "localhost" && AUTH_MODE === "none") {
  console.warn(
    `\n⚠  Kew is listening on ${HOST}:${PORT} with no authentication.\n` +
      "   Anyone who can reach this port can read job payloads and mutate queues.\n" +
      "   Set KEW_AUTH_PASSWORD=<secret>, or front Kew with an auth proxy and set KEW_TRUST_PROXY_AUTH=1.\n",
  );
}

process.on("uncaughtException", (err) => {
  console.error(`kew: uncaught ${err.message}`);
});
process.on("unhandledRejection", (reason) => {
  console.error(`kew: unhandled rejection ${String(reason)}`);
});

startSampler(redis, () => discoverQueues(redis));
void getVersionInfo();

const app = createApp({
  redis,
  retentionStore,
  readOnly: READ_ONLY,
  getVersion: getVersionInfo,
  auth: { requireAuth, me: handleMe, login: handleLogin, logout: handleLogout },
});

const dist = fileURLToPath(new URL("../../dashboard/dist", import.meta.url));

if (existsSync(dist)) {
  app.use("/*", serveStatic({ root: dist }));
  app.get("/*", serveStatic({ path: "index.html", root: dist }));
}

console.log(
  `Kew server → http://${HOST}:${PORT}  (redis: ${redactRedisUrl(REDIS_URL)}, auth: ${AUTH_MODE}, retention: ${env.KEW_RETENTION ? "on" : "off"})`,
);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, async () => {
    await retention?.stop().catch(() => {});
    retentionStore?.close();
    await redis.quit().catch(() => {});
    process.exit(0);
  });
}

export default { port: PORT, hostname: HOST, fetch: app.fetch };
