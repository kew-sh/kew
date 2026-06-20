import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const retainedJobs = sqliteTable(
  "retained_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    queue: text("queue").notNull(),
    jobId: text("job_id").notNull(),
    name: text("name").notNull(),
    state: text("state", { enum: ["completed", "failed"] }).notNull(),
    data: text("data"),
    opts: text("opts"),
    returnValue: text("return_value"),
    failedReason: text("failed_reason"),
    attemptsMade: integer("attempts_made"),
    timestamp: integer("timestamp"),
    processedOn: integer("processed_on"),
    finishedOn: integer("finished_on"),
    durationMs: integer("duration_ms"),
    capturedAt: integer("captured_at").notNull(),
    payloadCaptured: integer("payload_captured").notNull(),
  },
  (t) => [
    index("idx_retained_queue_captured").on(t.queue, t.capturedAt),
    index("idx_retained_captured").on(t.capturedAt),
  ],
);
