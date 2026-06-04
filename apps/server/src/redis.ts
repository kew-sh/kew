import { Redis } from "ioredis";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX ?? "bull";

export function redactRedisUrl(url: string): string {
  return url.replace(/(\/\/[^:/@]*:)[^@/]*@/, "$1***@");
}

/** maxRetriesPerRequest: null is required by BullMQ for blocking connections. */
export function createRedis(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}
