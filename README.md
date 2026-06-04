# Kew

**The dashboard for BullMQ** — standalone, fast, and complete. A modern alternative to bull-board for watching and managing your queues, jobs, and crons.

> Kew is an independent project, not affiliated with BullMQ or Taskforce.sh. "BullMQ" is a trademark of its owners; Kew works _with_ BullMQ.

## Features (open source)

- **Queue overview** — live health, per-state counts, throughput sparklines, sort by what's on fire.
- **Jobs** — virtualized table, search & filters, bulk retry/promote/remove, and **retry with an edited payload** (the thing bull-board can't do).
- **Schedulers** — cron & repeatable jobs with human-readable schedules and upcoming-run previews.
- **Flows** — parent/child job-tree visualization.
- **Metrics** — live throughput & failure charts.
- Standalone (no code injection into your app), real-time, dark-first, keyboard-friendly (`⌘K`).

## Quick start

```bash
bun install

# Dashboard with mock data (no Redis needed):
bun run dev                          # → http://localhost:5173

# Against a real Redis:
docker compose up -d redis
bun --filter '@kew/server' seed      # seed realistic BullMQ data
bun --filter '@kew/server' demo      # (optional) live load generator
bun --filter '@kew/server' start     # API on :3000
```

## Stack

Bun · Vite · React · TanStack (Query / Router / Table / Virtual) · Tailwind v4.

Monorepo (Bun workspaces):

- `apps/dashboard` — the dashboard SPA (served by a Bun + Hono process).
- `apps/server` — backend that reads a real Redis via BullMQ and serves the same `QueueApi` contract.
- `packages/core` — the `QueueApi` contract, domain types, and data layer shared by both.

## License

Business Source License 1.1 (source-available; converts to open source after the change date).
