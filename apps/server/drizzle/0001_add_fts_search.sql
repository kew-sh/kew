CREATE VIRTUAL TABLE IF NOT EXISTS retained_jobs_fts USING fts5(
  job_id, name, data,
  content='retained_jobs',
  content_rowid='id',
  tokenize='trigram'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS retained_jobs_fts_ai AFTER INSERT ON retained_jobs BEGIN
  INSERT INTO retained_jobs_fts(rowid, job_id, name, data)
  VALUES (new.id, new.job_id, new.name, new.data);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS retained_jobs_fts_ad AFTER DELETE ON retained_jobs BEGIN
  INSERT INTO retained_jobs_fts(retained_jobs_fts, rowid, job_id, name, data)
  VALUES ('delete', old.id, old.job_id, old.name, old.data);
END;
--> statement-breakpoint
INSERT INTO retained_jobs_fts(rowid, job_id, name, data)
SELECT id, job_id, name, data FROM retained_jobs;
