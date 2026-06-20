import { describe, expect, test } from "bun:test";
import { mergeCounts, mergeJobPages, sortKey } from "../src/merge-jobs";
import type { Job, JobCounts, JobPage, JobState } from "../src/types";

function job(id: string, over: Partial<Job> = {}): Job {
  return {
    id,
    name: "j",
    queue: "q",
    state: "completed",
    attemptsMade: 0,
    maxAttempts: 1,
    priority: 0,
    timestamp: 0,
    data: {},
    opts: {},
    ...over,
  };
}

function page(jobs: Job[], total = jobs.length, exact = true): JobPage {
  return { jobs, total, exact };
}

function counts(over: Partial<Record<JobState, number>> = {}): JobCounts {
  return {
    active: 0,
    waiting: 0,
    prioritized: 0,
    delayed: 0,
    "waiting-children": 0,
    completed: 0,
    failed: 0,
    paused: 0,
    ...over,
  };
}

describe("sortKey", () => {
  test("prefers finishedOn, falls back to timestamp then 0", () => {
    expect(sortKey(job("a", { timestamp: 1, finishedOn: 5 }))).toBe(5);
    expect(sortKey(job("a", { timestamp: 3 }))).toBe(3);
    expect(sortKey(job("a", { timestamp: 0 }))).toBe(0);
  });
});

describe("mergeJobPages", () => {
  test("dedups by id with the live copy winning", () => {
    const live = page([job("1", { finishedOn: 10, stacktrace: ["boom"] })], 1);
    const retained = page(
      [job("1", { finishedOn: 10, retained: true }), job("2", { finishedOn: 5, retained: true })],
      2,
    );
    const out = mergeJobPages(live, retained, 0, 100);
    expect(out.jobs.map((j) => j.id)).toEqual(["1", "2"]);
    const one = out.jobs.find((j) => j.id === "1");
    expect(one?.retained).toBeUndefined();
    expect(one?.stacktrace).toEqual(["boom"]);
    expect(out.total).toBe(2);
  });

  test("orders newest first across both sources", () => {
    const live = page([job("a", { finishedOn: 1 })], 1);
    const retained = page(
      [job("b", { finishedOn: 9, retained: true }), job("c", { finishedOn: 5, retained: true })],
      2,
    );
    const out = mergeJobPages(live, retained, 0, 100);
    expect(out.jobs.map((j) => j.id)).toEqual(["b", "c", "a"]);
  });

  test("slices page 0 to pageSize", () => {
    const live = page([job("a", { finishedOn: 3 }), job("b", { finishedOn: 2 })], 2);
    const retained = page([job("c", { finishedOn: 1, retained: true })], 1);
    const out = mergeJobPages(live, retained, 0, 2);
    expect(out.jobs.map((j) => j.id)).toEqual(["a", "b"]);
    expect(out.total).toBe(3);
  });

  test("total is never below the number of merged rows", () => {
    const live = page([], 0);
    const retained = page([job("c", { retained: true })], 1);
    expect(mergeJobPages(live, retained, 0, 100).total).toBe(1);
  });

  test("dedups duplicate retained rows for the same id, keeping the newest", () => {
    const live = page([], 0);
    const retained = page(
      [job("x", { finishedOn: 5, retained: true }), job("x", { finishedOn: 9, retained: true })],
      2,
    );
    const out = mergeJobPages(live, retained, 0, 100);
    expect(out.jobs.map((j) => j.id)).toEqual(["x"]);
    expect(out.jobs[0]?.finishedOn).toBe(9);
    expect(out.total).toBe(1);
  });
});

describe("mergeCounts", () => {
  test("adds completed and dedups the failed overlap; leaves other states", () => {
    const out = mergeCounts(
      counts({ completed: 0, failed: 50, active: 3 }),
      { completed: 200, failed: 200 },
      { completed: 0, failed: 50 },
    );
    expect(out.completed).toBe(200);
    expect(out.failed).toBe(200);
    expect(out.active).toBe(3);
  });

  test("clamps to zero when overlap exceeds the sum", () => {
    const out = mergeCounts(
      counts({ failed: 1 }),
      { completed: 0, failed: 0 },
      { completed: 0, failed: 5 },
    );
    expect(out.failed).toBe(0);
  });
});
