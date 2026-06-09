import { Database } from "bun:sqlite";
import type { RetainedJob, RetentionSink } from "@kew/core/server";
import type { HistoryQuery, Job, JobPage } from "@kew/core/types";

export interface SqliteRetentionOptions {
  path: string;
  maxAgeMs?: number;
  maxRows?: number;
  pruneIntervalMs?: number;
}

export interface RetentionStore {
  sink: RetentionSink;
  query(q: HistoryQuery): JobPage;
  counts(queue: string): { completed: number; failed: number };
  countOverlap(queue: string, state: "completed" | "failed", ids: string[]): number;
  get(queue: string, jobId: string): Job | undefined;
  remove(queue: string, ids: string[]): number;
  prune(): void;
  close(): void;
}

interface Row {
  queue: string;
  job_id: string;
  name: string;
  state: string;
  data: string | null;
  opts: string | null;
  return_value: string | null;
  failed_reason: string | null;
  attempts_made: number | null;
  timestamp: number | null;
  processed_on: number | null;
  finished_on: number | null;
  duration_ms: number | null;
  captured_at: number;
  payload_captured: number;
}

const DEFAULT_PRUNE_INTERVAL_MS = 60_000;
const MAX_PAGE_SIZE = 200;

function toJson(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function fromJson(value: string | null): unknown {
  if (value == null) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function toJob(row: Row): Job {
  const opts = (fromJson(row.opts) as Record<string, unknown>) ?? {};
  return {
    id: row.job_id,
    name: row.name,
    queue: row.queue,
    state: row.state as Job["state"],
    attemptsMade: row.attempts_made ?? 0,
    maxAttempts: (opts.attempts as number) ?? row.attempts_made ?? 1,
    priority: (opts.priority as number) ?? 0,
    timestamp: row.timestamp ?? row.captured_at,
    processedOn: row.processed_on ?? undefined,
    finishedOn: row.finished_on ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    data: fromJson(row.data),
    opts,
    returnValue: fromJson(row.return_value),
    failedReason: row.failed_reason ?? undefined,
    retained: true,
  };
}

// Append-only: each entry migrates the schema to the next version. Runs on every
// boot, so an updated image migrates an existing DB in place. Never reorder or delete.
const MIGRATIONS: ((db: Database) => void)[] = [
  (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS retained_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue TEXT NOT NULL,
        job_id TEXT NOT NULL,
        name TEXT NOT NULL,
        state TEXT NOT NULL,
        data TEXT,
        opts TEXT,
        return_value TEXT,
        failed_reason TEXT,
        attempts_made INTEGER,
        timestamp INTEGER,
        processed_on INTEGER,
        finished_on INTEGER,
        duration_ms INTEGER,
        captured_at INTEGER NOT NULL,
        payload_captured INTEGER NOT NULL
      );
    `);
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_retained_queue_captured ON retained_jobs (queue, captured_at DESC);",
    );
    db.run("CREATE INDEX IF NOT EXISTS idx_retained_captured ON retained_jobs (captured_at DESC);");
  },
];

function migrate(db: Database): void {
  const { user_version } = db.query("PRAGMA user_version").get() as { user_version: number };
  for (let version = user_version; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      MIGRATIONS[version](db);
      db.run(`PRAGMA user_version = ${version + 1}`);
    })();
  }
}

export function createSqliteRetention(options: SqliteRetentionOptions): RetentionStore {
  const db = new Database(options.path, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA busy_timeout = 5000;");
  migrate(db);

  const insert = db.prepare(`
    INSERT INTO retained_jobs
      (queue, job_id, name, state, data, opts, return_value, failed_reason,
       attempts_made, timestamp, processed_on, finished_on, duration_ms, captured_at, payload_captured)
    VALUES
      ($queue, $jobId, $name, $state, $data, $opts, $returnValue, $failedReason,
       $attemptsMade, $timestamp, $processedOn, $finishedOn, $durationMs, $capturedAt, $payloadCaptured)
  `);

  const insertMany = db.transaction((records: RetainedJob[]) => {
    for (const r of records) {
      insert.run({
        $queue: r.queue,
        $jobId: r.jobId,
        $name: r.name,
        $state: r.state,
        $data: toJson(r.data),
        $opts: toJson(r.opts),
        $returnValue: toJson(r.returnValue),
        $failedReason: r.failedReason ?? null,
        $attemptsMade: r.attemptsMade ?? null,
        $timestamp: r.timestamp ?? null,
        $processedOn: r.processedOn ?? null,
        $finishedOn: r.finishedOn ?? null,
        $durationMs: r.durationMs ?? null,
        $capturedAt: r.capturedAt,
        $payloadCaptured: r.payloadCaptured ? 1 : 0,
      });
    }
  });

  function prune(): void {
    if (options.maxAgeMs) {
      db.run("DELETE FROM retained_jobs WHERE captured_at < ?", [Date.now() - options.maxAgeMs]);
    }
    if (options.maxRows) {
      db.run("DELETE FROM retained_jobs WHERE id <= (SELECT MAX(id) FROM retained_jobs) - ?", [
        options.maxRows,
      ]);
    }
  }

  function query(q: HistoryQuery): JobPage {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (q.queue) {
      where.push("queue = ?");
      params.push(q.queue);
    }
    if (q.state) {
      where.push("state = ?");
      params.push(q.state);
    }
    if (typeof q.from === "number") {
      where.push("captured_at >= ?");
      params.push(q.from);
    }
    if (typeof q.to === "number") {
      where.push("captured_at <= ?");
      params.push(q.to);
    }
    if (q.search) {
      where.push("(job_id LIKE ? OR name LIKE ? OR data LIKE ?)");
      const like = `%${q.search}%`;
      params.push(like, like, like);
    }

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, q.pageSize));
    const page = Math.max(0, q.page);

    const total = (
      db.query(`SELECT COUNT(*) AS c FROM retained_jobs ${clause}`).get(...params) as { c: number }
    ).c;
    const rows = db
      .query(
        `SELECT * FROM retained_jobs ${clause} ORDER BY captured_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, page * pageSize) as Row[];

    return { jobs: rows.map(toJob), total, exact: true };
  }

  function counts(queue: string): { completed: number; failed: number } {
    const row = db
      .query(
        `SELECT
           COUNT(DISTINCT CASE WHEN state = 'completed' THEN job_id END) AS completed,
           COUNT(DISTINCT CASE WHEN state = 'failed' THEN job_id END) AS failed
         FROM retained_jobs WHERE queue = ?`,
      )
      .get(queue) as { completed: number | null; failed: number | null };
    return { completed: row.completed ?? 0, failed: row.failed ?? 0 };
  }

  function countOverlap(queue: string, state: "completed" | "failed", ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(",");
    const row = db
      .query(
        `SELECT COUNT(DISTINCT job_id) AS c FROM retained_jobs
         WHERE queue = ? AND state = ? AND job_id IN (${placeholders})`,
      )
      .get(queue, state, ...ids) as { c: number };
    return row.c;
  }

  function get(queue: string, jobId: string): Job | undefined {
    const row = db
      .query(
        `SELECT * FROM retained_jobs WHERE queue = ? AND job_id = ?
         ORDER BY captured_at DESC, id DESC LIMIT 1`,
      )
      .get(queue, jobId) as Row | null;
    return row ? toJob(row) : undefined;
  }

  function remove(queue: string, ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(",");
    const removed = (
      db
        .query(
          `SELECT COUNT(DISTINCT job_id) AS c FROM retained_jobs
           WHERE queue = ? AND job_id IN (${placeholders})`,
        )
        .get(queue, ...ids) as { c: number }
    ).c;
    db.run(`DELETE FROM retained_jobs WHERE queue = ? AND job_id IN (${placeholders})`, [
      queue,
      ...ids,
    ]);
    return removed;
  }

  const pruneTimer = setInterval(prune, options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS);

  return {
    sink: { write: (records) => insertMany(records) },
    query,
    counts,
    countOverlap,
    get,
    remove,
    prune,
    close() {
      clearInterval(pruneTimer);
      db.close();
    },
  };
}
