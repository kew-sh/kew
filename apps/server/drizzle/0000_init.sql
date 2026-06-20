CREATE TABLE IF NOT EXISTS `retained_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue` text NOT NULL,
	`job_id` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`data` text,
	`opts` text,
	`return_value` text,
	`failed_reason` text,
	`attempts_made` integer,
	`timestamp` integer,
	`processed_on` integer,
	`finished_on` integer,
	`duration_ms` integer,
	`captured_at` integer NOT NULL,
	`payload_captured` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_retained_queue_captured` ON `retained_jobs` (`queue`,`captured_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_retained_captured` ON `retained_jobs` (`captured_at`);