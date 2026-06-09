# Changelog

All notable changes to Kew are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-06-08

### Added

- **Retained jobs in the per-queue Completed and Failed tabs**: completed and failed jobs recorded by retention now appear inline in each queue's own tabs, merged with live Redis jobs and de-duplicated (the live copy wins, keeping its stacktrace and actions). Jobs cleared by `removeOnComplete` are finally visible where you'd expect them, not only in the global History page. Retained-only rows are tagged `retained`, excluded from bulk actions, and the tab badge counts include them (de-duplicated by job id).
- **Re-run**: a retained job that is gone from Redis can be re-enqueued as a new job from its saved payload, via a Re-run action in the job drawer and the `POST /api/queues/:name/jobs/:id/rerun` endpoint. Disabled in `READ_ONLY` mode.

### Changed

- **Retention is now enabled by default.** `KEW_RETENTION` defaults to on; set `KEW_RETENTION=0` to disable. Previously it was opt-in via `KEW_RETENTION=1`.

### Fixed

- **Payload capture for short-lived jobs**: retention now snapshots the job on the `waiting` event in addition to `active`, so the payload is captured before `removeOnComplete` deletes very fast jobs from Redis.

## [1.1.0] - 2026-06-06

### Added

- **Version & update indicator** in the sidebar: shows the running version (read from `package.json`) and checks GitHub hourly for a newer release, surfacing a subtle "update available" link. The check runs server-side, is cached, and fails soft; it is enabled by default and can be disabled with `KEW_UPDATE_CHECK=0`.
- **Collapsible sidebar**: collapse to icons with hover tooltips, toggle via the rail or `⌘`/`Ctrl`+`B`, and a slide-in drawer on mobile. The collapsed state persists across reloads.

### Fixed

- Root static files (`favicon.svg`, `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`) were served as `index.html` by the embedded server, so the browser tab showed no icon. They are now served with the correct content type.

## [1.0.0] - 2026-06-06

The first public release of Kew: a standalone, self-hosted dashboard for BullMQ.

### Added

- **Queue overview** with live health, per-state counts, throughput sparklines, and sorting by health, backlog, or name.
- **Jobs**: a virtualized table with search, state filters, bulk retry/promote/remove, and **retry with an edited payload**.
- **History**: a durable record of completed and failed jobs in SQLite, kept even when `removeOnComplete` clears them from Redis. Opt-in via `KEW_RETENTION`, with automatic schema migrations on startup and configurable retention windows.
- **Schedulers**: create, inspect, and remove BullMQ cron and repeatable jobs, with human-readable schedules and next-run previews.
- **Flows**: parent and child job-tree visualization for BullMQ flows.
- **Metrics**: live throughput and failure charts.
- **Auth**: an optional shared login (email + password) via `KEW_AUTH_EMAIL` and `KEW_AUTH_PASSWORD`, validated at boot; a `READ_ONLY` mode that disables every mutation; and reverse-proxy auth via `KEW_TRUST_PROXY_AUTH`.
- **Single Docker image** that serves the dashboard and API on one port (`5399`), published multi-arch (linux/amd64 and linux/arm64) to GHCR.
- A `⌘K` command palette, a dark-first UI, and colorblind-safe job states (color, icon, and label).

[Unreleased]: https://github.com/kew-sh/kew/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/kew-sh/kew/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/kew-sh/kew/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/kew-sh/kew/releases/tag/v1.0.0
