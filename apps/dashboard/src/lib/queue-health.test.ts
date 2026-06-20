import { describe, expect, it } from "vitest";
import { mkQueue } from "@/test/handlers";
import { backlog, queueHealth } from "./queue-health";

describe("queueHealth", () => {
  it("reports paused before anything else", () => {
    expect(
      queueHealth(mkQueue("q", { paused: true, counts: counts({ active: 5, failed: 99 }) })),
    ).toBe("paused");
  });

  it("reports failed when the fail rate crosses 8%", () => {
    expect(queueHealth(mkQueue("q", { failRate: 0.09 }))).toBe("failed");
  });

  it("reports failed when there are more than 50 failed jobs", () => {
    expect(queueHealth(mkQueue("q", { counts: counts({ failed: 51 }) }))).toBe("failed");
  });

  it("reports active when work is in flight and health is otherwise fine", () => {
    expect(queueHealth(mkQueue("q", { counts: counts({ active: 1 }) }))).toBe("active");
  });

  it("reports waiting when there is a backlog but nothing active", () => {
    expect(queueHealth(mkQueue("q", { counts: counts({ waiting: 3 }) }))).toBe("waiting");
  });

  it("reports completed when idle and healthy", () => {
    expect(queueHealth(mkQueue("q"))).toBe("completed");
  });
});

describe("backlog", () => {
  it("sums waiting, prioritized, and active", () => {
    expect(
      backlog(mkQueue("q", { counts: counts({ waiting: 2, prioritized: 3, active: 5 }) })),
    ).toBe(10);
  });

  it("ignores completed, failed, delayed, and paused", () => {
    expect(
      backlog(mkQueue("q", { counts: counts({ completed: 9, failed: 9, delayed: 9, paused: 9 }) })),
    ).toBe(0);
  });
});

function counts(over: Partial<QueueCounts> = {}): QueueCounts {
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

type QueueCounts = ReturnType<typeof mkQueue>["counts"];
