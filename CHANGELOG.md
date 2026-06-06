# Changelog

All notable changes to Kew are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/kew-sh/kew/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kew-sh/kew/releases/tag/v1.0.0
