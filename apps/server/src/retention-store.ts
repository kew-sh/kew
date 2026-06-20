import { Database } from "bun:sqlite";
import { fileURLToPath } from "node:url";
import { and, desc, eq, gte, inArray, like, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { retainedJobs } from "./db/schema";
import type { RetainedJob, RetentionSink } from "./queue";
import type { HistoryQuery, Job, JobPage } from "./types";

const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));
const MAX_PAGE_SIZE = 200;
const DEFAULT_PRUNE_INTERVAL_MS = 60_000;

export interface SqliteRetentionOptions {
  path: string;
  maxAgeMs?: number;
  maxRows?: number;
  pruneIntervalMs?: number;
  migrate?: boolean;
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

type Row = typeof retainedJobs.$inferSelect;

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
    id: row.jobId,
    name: row.name,
    queue: row.queue,
    state: row.state,
    attemptsMade: row.attemptsMade ?? 0,
    maxAttempts: (opts.attempts as number) ?? row.attemptsMade ?? 1,
    priority: (opts.priority as number) ?? 0,
    timestamp: row.timestamp ?? row.capturedAt,
    processedOn: row.processedOn ?? undefined,
    finishedOn: row.finishedOn ?? undefined,
    durationMs: row.durationMs ?? undefined,
    data: fromJson(row.data),
    opts,
    returnValue: fromJson(row.returnValue),
    failedReason: row.failedReason ?? undefined,
    retained: true,
  };
}

function openDb(path: string): Database {
  const sqlite = new Database(path, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL;");
  sqlite.run("PRAGMA busy_timeout = 5000;");

  return sqlite;
}

function searchFilter(search: string) {
  if (search.length < 3) {
    const pattern = `%${search}%`;

    return or(
      like(retainedJobs.jobId, pattern),
      like(retainedJobs.name, pattern),
      like(retainedJobs.data, pattern),
    );
  }

  const match = `"${search.replace(/"/g, '""')}"`;

  return sql`${retainedJobs.id} IN (SELECT rowid FROM retained_jobs_fts WHERE retained_jobs_fts MATCH ${match})`;
}

export function createSqliteRetention(options: SqliteRetentionOptions): RetentionStore {
  const sqlite = openDb(options.path);
  const db = drizzle(sqlite);

  if (options.migrate ?? true) {
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  }

  function insertMany(records: RetainedJob[]): void {
    if (records.length === 0) return;

    db.insert(retainedJobs)
      .values(
        records.map((r) => ({
          queue: r.queue,
          jobId: r.jobId,
          name: r.name,
          state: r.state,
          data: toJson(r.data),
          opts: toJson(r.opts),
          returnValue: toJson(r.returnValue),
          failedReason: r.failedReason ?? null,
          attemptsMade: r.attemptsMade ?? null,
          timestamp: r.timestamp ?? null,
          processedOn: r.processedOn ?? null,
          finishedOn: r.finishedOn ?? null,
          durationMs: r.durationMs ?? null,
          capturedAt: r.capturedAt,
          payloadCaptured: r.payloadCaptured ? 1 : 0,
        })),
      )
      .run();
  }

  function query(q: HistoryQuery): JobPage {
    const filters = [];

    if (q.queue) filters.push(eq(retainedJobs.queue, q.queue));
    if (q.state) filters.push(eq(retainedJobs.state, q.state));
    if (typeof q.from === "number") filters.push(gte(retainedJobs.capturedAt, q.from));
    if (typeof q.to === "number") filters.push(lte(retainedJobs.capturedAt, q.to));

    if (q.search) filters.push(searchFilter(q.search));

    const where = filters.length ? and(...filters) : undefined;
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, q.pageSize));
    const page = Math.max(0, q.page);

    const total =
      db.select({ c: sql<number>`count(*)` }).from(retainedJobs).where(where).get()?.c ?? 0;
    const rows = db
      .select()
      .from(retainedJobs)
      .where(where)
      .orderBy(desc(retainedJobs.capturedAt), desc(retainedJobs.id))
      .limit(pageSize)
      .offset(page * pageSize)
      .all();

    return { jobs: rows.map(toJob), total, exact: true };
  }

  function counts(queue: string): { completed: number; failed: number } {
    const row = db
      .select({
        completed: sql<number>`COUNT(DISTINCT CASE WHEN ${retainedJobs.state} = 'completed' THEN ${retainedJobs.jobId} END)`,
        failed: sql<number>`COUNT(DISTINCT CASE WHEN ${retainedJobs.state} = 'failed' THEN ${retainedJobs.jobId} END)`,
      })
      .from(retainedJobs)
      .where(eq(retainedJobs.queue, queue))
      .get();

    return { completed: row?.completed ?? 0, failed: row?.failed ?? 0 };
  }

  function countOverlap(queue: string, state: "completed" | "failed", ids: string[]): number {
    if (ids.length === 0) return 0;

    return (
      db
        .select({ c: sql<number>`COUNT(DISTINCT ${retainedJobs.jobId})` })
        .from(retainedJobs)
        .where(
          and(
            eq(retainedJobs.queue, queue),
            eq(retainedJobs.state, state),
            inArray(retainedJobs.jobId, ids),
          ),
        )
        .get()?.c ?? 0
    );
  }

  function get(queue: string, jobId: string): Job | undefined {
    const row = db
      .select()
      .from(retainedJobs)
      .where(and(eq(retainedJobs.queue, queue), eq(retainedJobs.jobId, jobId)))
      .orderBy(desc(retainedJobs.capturedAt), desc(retainedJobs.id))
      .limit(1)
      .get();

    return row ? toJob(row) : undefined;
  }

  function remove(queue: string, ids: string[]): number {
    if (ids.length === 0) return 0;

    const match = and(eq(retainedJobs.queue, queue), inArray(retainedJobs.jobId, ids));
    const removed =
      db
        .select({ c: sql<number>`COUNT(DISTINCT ${retainedJobs.jobId})` })
        .from(retainedJobs)
        .where(match)
        .get()?.c ?? 0;

    db.delete(retainedJobs).where(match).run();

    return removed;
  }

  function prune(): void {
    if (options.maxAgeMs) {
      db.delete(retainedJobs)
        .where(lt(retainedJobs.capturedAt, Date.now() - options.maxAgeMs))
        .run();
    }

    if (options.maxRows) {
      const maxId = db
        .select({ m: sql<number>`MAX(${retainedJobs.id})` })
        .from(retainedJobs)
        .get()?.m;

      if (maxId != null) {
        db.delete(retainedJobs)
          .where(lte(retainedJobs.id, maxId - options.maxRows))
          .run();
      }
    }
  }

  const pruneTimer = setInterval(prune, options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS);

  return {
    sink: { write: insertMany },
    query,
    counts,
    countOverlap,
    get,
    remove,
    prune,
    close() {
      clearInterval(pruneTimer);
      sqlite.close();
    },
  };
}
