import { Redis } from "ioredis";
import type { ConnectionInfo } from "../types";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX ?? "bull";

const SECRET_QUERY_KEY = /^(password|pass|pwd|auth|token|secret)$/i;

function redactNode(node: string): string {
  const hasScheme = node.includes("://");
  try {
    const parsed = new URL(hasScheme ? node : `redis://${node}`);
    if (parsed.password) parsed.password = "***";
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_QUERY_KEY.test(key)) parsed.searchParams.set(key, "***");
    }
    const out = parsed.toString();
    return hasScheme ? out : out.replace(/^redis:\/\//, "");
  } catch {
    return node.replace(/(\/\/[^/@]*:)[^@]*@/, "$1***@");
  }
}

export function redactRedisUrl(url: string): string {
  return url.split(",").map(redactNode).join(",");
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
