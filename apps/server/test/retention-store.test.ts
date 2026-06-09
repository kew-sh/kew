import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import type { RetainedJob } from "@kew/core/server";
import { createSqliteRetention } from "../src/retention-store";

function tempPath(): string {
  return `/tmp/kew-retention-test-${crypto.randomUUID().slice(0, 8)}.db`;
}

function cleanup(path: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      unlinkSync(path + suffix);
    } catch {}
  }
}

function rec(over: Partial<RetainedJob>): RetainedJob {
  return {
    queue: "q",
    jobId: "1",
    name: "job",
    state: "completed",
    data: { a: 1 },
    opts: { attempts: 3 },
    returnValue: { ok: true },
    capturedAt: 1000,
    payloadCaptured: true,
    ...over,
  };
}

describe("sqlite retention store", () => {
  test("writes and queries history with filters", () => {
    const store = createSqliteRetention({ path: ":memory:" });
    try {
      store.sink.write([
        rec({
          jobId: "1",
          queue: "emails",
          state: "completed",
          data: { to: "alice" },
          capturedAt: 1000,
        }),
        rec({
          jobId: "2",
          queue: "emails",
          state: "failed",
          failedReason: "boom",
          data: { to: "bob" },
          capturedAt: 2000,
        }),
        rec({
          jobId: "3",
          queue: "reports",
          state: "completed",
          data: { kind: "weekly" },
          capturedAt: 3000,
        }),
      ]);

      const all = store.query({ page: 0, pageSize: 50 });
      expect(all.total).toBe(3);
      expect(all.exact).toBe(true);
      expect(all.jobs[0].id).toBe("3");

      const failed = store.query({ state: "failed", page: 0, pageSize: 50 });
      expect(failed.total).toBe(1);
      expect(failed.jobs[0].failedReason).toBe("boom");
      expect(failed.jobs[0].data).toEqual({ to: "bob" });

      const byQueue = store.query({ queue: "emails", page: 0, pageSize: 50 });
      expect(byQueue.total).toBe(2);

      const windowed = store.query({ from: 1500, to: 2500, page: 0, pageSize: 50 });
      expect(windowed.total).toBe(1);
      expect(windowed.jobs[0].id).toBe("2");

      const searched = store.query({ search: "weekly", page: 0, pageSize: 50 });
      expect(searched.total).toBe(1);
      expect(searched.jobs[0].id).toBe("3");

      const completed = store.query({ state: "completed", page: 0, pageSize: 50 });
      expect(completed.jobs[0].maxAttempts).toBe(3);
    } finally {
      store.close();
    }
  });

  test("paginates newest-first", () => {
    const store = createSqliteRetention({ path: ":memory:" });
    try {
      store.sink.write(
        Array.from({ length: 5 }, (_, i) => rec({ jobId: String(i), capturedAt: 1000 + i })),
      );
      const p0 = store.query({ page: 0, pageSize: 2 });
      expect(p0.total).toBe(5);
      expect(p0.jobs.map((j) => j.id)).toEqual(["4", "3"]);
      const p1 = store.query({ page: 1, pageSize: 2 });
      expect(p1.jobs.map((j) => j.id)).toEqual(["2", "1"]);
    } finally {
      store.close();
    }
  });

  test("remove deletes all rows for the given ids and returns distinct ids removed", () => {
    const store = createSqliteRetention({ path: ":memory:" });
    try {
      store.sink.write([
        rec({ jobId: "1", queue: "q", state: "failed", capturedAt: 1000 }),
        rec({ jobId: "1", queue: "q", state: "failed", capturedAt: 1001 }),
        rec({ jobId: "2", queue: "q", state: "completed", capturedAt: 1002 }),
        rec({ jobId: "9", queue: "other", state: "failed", capturedAt: 1003 }),
      ]);

      const removed = store.remove("q", ["1", "missing"]);
      expect(removed).toBe(1);
      expect(store.query({ queue: "q", page: 0, pageSize: 50 }).total).toBe(1);
      expect(store.query({ queue: "other", page: 0, pageSize: 50 }).total).toBe(1);
      expect(store.remove("q", [])).toBe(0);
    } finally {
      store.close();
    }
  });

  test("counts distinct job ids per state; get returns the newest row", () => {
    const store = createSqliteRetention({ path: ":memory:" });
    try {
      store.sink.write([
        rec({ jobId: "1", queue: "q", state: "failed", capturedAt: 1000, failedReason: "first" }),
        rec({ jobId: "1", queue: "q", state: "failed", capturedAt: 2000, failedReason: "second" }),
        rec({ jobId: "2", queue: "q", state: "completed", capturedAt: 1500 }),
      ]);

      expect(store.counts("q")).toEqual({ completed: 1, failed: 1 });
      expect(store.countOverlap("q", "failed", ["1", "x"])).toBe(1);
      expect(store.get("q", "1")?.failedReason).toBe("second");
      expect(store.get("q", "nope")).toBeUndefined();
    } finally {
      store.close();
    }
  });

  test("prune by maxRows keeps the newest rows", () => {
    const store = createSqliteRetention({ path: ":memory:", maxRows: 2 });
    try {
      store.sink.write(
        Array.from({ length: 5 }, (_, i) => rec({ jobId: String(i), capturedAt: 1000 + i })),
      );
      store.prune();
      const after = store.query({ page: 0, pageSize: 50 });
      expect(after.total).toBe(2);
      expect(after.jobs.map((j) => j.id)).toEqual(["4", "3"]);
    } finally {
      store.close();
    }
  });

  test("prune by maxAgeMs drops old rows", () => {
    const store = createSqliteRetention({ path: ":memory:", maxAgeMs: 60_000 });
    try {
      store.sink.write([
        rec({ jobId: "old", capturedAt: Date.now() - 120_000 }),
        rec({ jobId: "fresh", capturedAt: Date.now() }),
      ]);
      store.prune();
      const after = store.query({ page: 0, pageSize: 50 });
      expect(after.total).toBe(1);
      expect(after.jobs[0].id).toBe("fresh");
    } finally {
      store.close();
    }
  });
});

describe("sqlite retention migrations", () => {
  test("data survives reopening the same file and the schema is versioned", () => {
    const path = tempPath();
    try {
      const first = createSqliteRetention({ path });
      first.sink.write([rec({ jobId: "1", queue: "emails" })]);
      first.close();

      const second = createSqliteRetention({ path });
      expect(second.query({ page: 0, pageSize: 10 }).total).toBe(1);
      second.close();

      const raw = new Database(path);
      const { user_version } = raw.query("PRAGMA user_version").get() as { user_version: number };
      expect(user_version).toBe(1);
      raw.close();
    } finally {
      cleanup(path);
    }
  });

  test("adopts a pre-existing db that has no version, without losing rows", () => {
    const path = tempPath();
    try {
      const legacy = new Database(path, { create: true });
      legacy.run(
        "CREATE TABLE retained_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT NOT NULL, job_id TEXT NOT NULL, name TEXT NOT NULL, state TEXT NOT NULL, data TEXT, opts TEXT, return_value TEXT, failed_reason TEXT, attempts_made INTEGER, timestamp INTEGER, processed_on INTEGER, finished_on INTEGER, duration_ms INTEGER, captured_at INTEGER NOT NULL, payload_captured INTEGER NOT NULL);",
      );
      legacy.run(
        "INSERT INTO retained_jobs (queue, job_id, name, state, captured_at, payload_captured) VALUES ('emails', '99', 'old-job', 'completed', 1000, 1);",
      );
      legacy.close();

      const store = createSqliteRetention({ path });
      const page = store.query({ page: 0, pageSize: 10 });
      expect(page.total).toBe(1);
      expect(page.jobs[0].id).toBe("99");
      store.close();

      const raw = new Database(path);
      const { user_version } = raw.query("PRAGMA user_version").get() as { user_version: number };
      expect(user_version).toBe(1);
      raw.close();
    } finally {
      cleanup(path);
    }
  });
});
