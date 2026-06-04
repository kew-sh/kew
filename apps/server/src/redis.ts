import type { ConnectionInfo } from "@kew/core/types";
import { Redis } from "ioredis";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX ?? "bull";

export function redactRedisUrl(url: string): string {
  return url.replace(/(\/\/[^:/@]*:)[^@/]*@/, "$1***@");
}

let everReady = false;
let lastErrorLog = 0;
const startedAt = Date.now();

export function createRedis(): Redis {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  redis.on("ready", () => {
    everReady = true;
  });
  redis.on("error", (err) => {
    const now = Date.now();
    if (now - lastErrorLog > 10_000) {
      lastErrorLog = now;
      console.error(`redis: ${err.message}`);
    }
  });
  return redis;
}

export function redisStatus(redis: Redis): ConnectionInfo["status"] {
  if (redis.status === "ready") return "connected";
  if (everReady) return "error";
  if (redis.status !== "close" && redis.status !== "end" && Date.now() - startedAt < 8000) {
    return "connecting";
  }
  return "error";
}
