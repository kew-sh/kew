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

### Docker

```bash
docker compose up --build              # Kew on http://localhost:5399, plus a Redis to play with
bun --filter '@kew/server' seed        # (optional) load realistic sample data into that Redis
```

Point Kew at your own Redis with `REDIS_URL` (every setting is documented in `.env.example`). To require a login, set `KEW_AUTH_TOKEN` (and optionally `KEW_AUTH_USER` for an email + password form). The server binds `127.0.0.1` by default and warns loudly if you expose it without auth.

### From source

```bash
bun install
docker compose up -d redis             # or set REDIS_URL to your own
bun --filter '@kew/server' seed        # realistic sample data
bun --filter '@kew/server' demo        # (optional) live load generator
bun run server                         # API + embedded dashboard on :5399
bun run dev                            # or the Vite dev server on :5173 (proxies /api → :5399)
```

The dashboard always talks to a real backend (no mock), so bring up Redis and the server first.

## Stack

Bun · Vite · React · TanStack (Query / Router / Table / Virtual) · Tailwind v4.

Monorepo (Bun workspaces):

- `apps/dashboard` — the dashboard SPA (served by a Bun + Hono process).
- `apps/server` — backend that reads a real Redis via BullMQ and serves the same `QueueApi` contract.
- `packages/core` — the `QueueApi` contract, domain types, and data layer shared by both.

## License

[Business Source License 1.1](LICENSE) — source-available. Read it, modify it, self-host it, and run it in production freely; you just may not offer Kew to third parties as a competing hosted or managed service. It converts to Apache 2.0 on the Change Date. See [NOTICE](NOTICE) for trademark and third-party attributions.
