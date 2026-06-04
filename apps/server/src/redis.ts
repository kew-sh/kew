import { Redis } from "ioredis";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX ?? "bull";

/** maxRetriesPerRequest: null is required by BullMQ for blocking connections. */
export function createRedis(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}
