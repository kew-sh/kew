import type { Redis } from "ioredis";
import { getQueue } from "./queue-service";

/**
 * BullMQ's getMetrics only has data if workers opt into metrics. To always show
 * a real throughput sparkline, we sample completed/failed counts on a timer and
 * keep a rolling window of deltas per queue. This is the "dashboard samples
 * counts over time" approach, independent of worker config.
 */

const WINDOW = 30;
const INTERVAL_MS = 2500;

interface Win {
  throughput: number[];
  failures: number[];
  lastCompleted: number;
  lastFailed: number;
}

const windows = new Map<string, Win>();

export function getWindow(name: string) {
  const w = windows.get(name) ?? {
    throughput: Array(WINDOW).fill(0),
    failures: Array(WINDOW).fill(0),
    lastCompleted: 0,
    lastFailed: 0,
  };
  const completed = w.throughput.reduce((a, b) => a + b, 0);
  const failed = w.failures.reduce((a, b) => a + b, 0);
  return {
    throughput: w.throughput,
    failures: w.failures,
    ratePerMin: w.throughput[w.throughput.length - 1] ?? 0,
    failRate: completed + failed === 0 ? 0 : failed / (completed + failed),
  };
}

export function startSampler(redis: Redis, getNames: () => Promise<string[]>) {
  const tick = async () => {
    let names: string[] = [];
    try {
      names = await getNames();
    } catch {
      return;
    }
    for (const name of names) {
      try {
        const c = await getQueue(name, redis).getJobCounts("completed", "failed");
        const completed = (c as Record<string, number>).completed ?? 0;
        const failed = (c as Record<string, number>).failed ?? 0;
        const prev = windows.get(name);
        if (!prev) {
          windows.set(name, {
            throughput: Array(WINDOW).fill(0),
            failures: Array(WINDOW).fill(0),
            lastCompleted: completed,
            lastFailed: failed,
          });
          continue;
        }
        prev.throughput = [...prev.throughput.slice(1), Math.max(0, completed - prev.lastCompleted)];
        prev.failures = [...prev.failures.slice(1), Math.max(0, failed - prev.lastFailed)];
        prev.lastCompleted = completed;
        prev.lastFailed = failed;
      } catch {
        /* queue vanished between discovery and sample; ignore */
      }
    }
  };
  void tick();
  setInterval(() => void tick(), INTERVAL_MS);
}
