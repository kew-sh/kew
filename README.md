<div align="center">

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/kew-mark.svg">
  <img alt="Kew" src="docs/kew-mark-mono.svg" width="76" height="76">
</picture>

# Kew

### The dashboard for [BullMQ](https://bullmq.io)

Watch and manage your queues, jobs, and crons from one clean, fast UI.
**Self-hosted · real-time · no code injection.** A modern, standalone alternative to bull-board.

<br>

[![License: BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-a855f7?style=for-the-badge)](LICENSE)
[![Release](https://img.shields.io/github/v/release/kew-sh/kew?style=for-the-badge&color=a855f7&label=release)](https://github.com/kew-sh/kew/releases)
[![Container](https://img.shields.io/badge/ghcr.io-kew--sh%2Fkew-a855f7?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/kew-sh/kew/pkgs/container/kew)
[![Stars](https://img.shields.io/github/stars/kew-sh/kew?style=for-the-badge&color=a855f7)](https://github.com/kew-sh/kew/stargazers)

**[Quick start](#run-it)** · **[Configuration](#configuration)** · **[Security](#security)** · **[kew.sh](https://kew.sh)**

<br>

</div>

<!-- Hero screenshot — capture the Overview and drop it in to bring this to life:
<p align="center"><img src="docs/screenshot.png" alt="Kew dashboard" width="900"></p>
-->

<div align="center">
<table>
<tr><td>

```bash
docker run -p 5399:5399 -e REDIS_URL=redis://your-redis:6379 ghcr.io/kew-sh/kew:latest
```

</td></tr>
</table>
<sub>One command. Point it at your Redis. Open <b>localhost:5399</b>. That's the whole setup.</sub>
</div>

<br>

> Kew is an independent project, not affiliated with BullMQ or Taskforce.sh. "BullMQ" is a trademark of its owners; Kew works _with_ BullMQ.

## Features

<table>
<tr>
<td width="33%" valign="top">

#### Queue overview
Live health, per-state counts, and throughput sparklines, sorted by what's on fire.

</td>
<td width="33%" valign="top">

#### Jobs
Virtualized table, search & filters, bulk actions, and **retry with an edited payload**.

</td>
<td width="33%" valign="top">

#### History
A durable record of completed and failed jobs, kept even when `removeOnComplete` wipes Redis.

</td>
</tr>
<tr>
<td width="33%" valign="top">

#### Schedulers
Cron and repeatable jobs with human-readable schedules and next-run previews.

</td>
<td width="33%" valign="top">

#### Flows
Parent and child job-tree visualization for BullMQ flows.

</td>
<td width="33%" valign="top">

#### Metrics
Live throughput and failure charts, updated in real time.

</td>
</tr>
</table>

Dark-first, keyboard-friendly (`⌘K`), and secure by default.

## Why Kew

- **Standalone.** No middleware, no code injected into your app. Kew talks straight to your Redis.
- **Retry with an edited payload.** Fix the bad input and re-run the exact job, right from the drawer.
- **History that outlives Redis.** Completed and failed runs are kept even when `removeOnComplete` clears them.
- **Built for operators.** Cron UI, flows, live metrics, read-only mode, and a login, out of the box.
- **Fast and sharp.** Real-time, dark-first, virtualized tables, and a `⌘K` command palette throughout.

## Run it

Kew is a **single Docker image** that serves the dashboard and API on one port (`5399`). Point it at your Redis:

```bash
docker run -p 5399:5399 \
  -e REDIS_URL=redis://YOUR_REDIS_HOST:6379 \
  ghcr.io/kew-sh/kew:latest
```

Then open **http://localhost:5399**.

<details>
<summary><b>Recommended: with login + durable history</b></summary>

<br>

```bash
docker run -p 5399:5399 \
  -e REDIS_URL=redis://YOUR_REDIS_HOST:6379 \
  -e KEW_AUTH_PASSWORD=pick-a-strong-secret \
  -e KEW_RETENTION=1 \
  -v kew-data:/data \
  ghcr.io/kew-sh/kew:latest
```

`KEW_AUTH_PASSWORD` puts a login in front of Kew. `KEW_RETENTION=1` plus the `kew-data` volume keeps your job history across restarts.

</details>

<details>
<summary><b>Docker Compose</b></summary>

<br>

Save this as `docker-compose.yml` and run `docker compose up -d`:

```yaml
services:
  kew:
    image: ghcr.io/kew-sh/kew:latest
    ports:
      - "5399:5399"
    environment:
      REDIS_URL: redis://YOUR_REDIS_HOST:6379
      KEW_AUTH_PASSWORD: pick-a-strong-secret
      KEW_RETENTION: "1"
    volumes:
      - kew-data:/data

volumes:
  kew-data:
```

</details>

## Configuration

Everything is set through environment variables:

| Variable | Default | What it does |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Your Redis. Supports `rediss://`, password, and ACL user. |
| `BULLMQ_PREFIX` | `bull` | Match your queues' BullMQ key prefix. |
| `KEW_AUTH_PASSWORD` | _(empty)_ | The shared password for the login. Empty means no auth (localhost only). |
| `KEW_AUTH_EMAIL` | _(empty)_ | Optional email shown on the login form (the password is still `KEW_AUTH_PASSWORD`). |
| `KEW_RETENTION` | _(off)_ | `1` to keep a durable job history. Needs a volume at `/data`. |
| `READ_ONLY` | `0` | `1` to disable every mutation (view-only). |
| `PORT` | `5399` | The port Kew listens on. |

<details>
<summary>More (TLS, retention windows, reverse-proxy auth…)</summary>

<br>

See [`.env.example`](.env.example) for the complete, commented list, including `KEW_SESSION_SECRET`, `KEW_RETENTION_MAX_AGE_DAYS`, `KEW_RETENTION_MAX_ROWS`, `KEW_TRUST_PROXY_AUTH`, and `KEW_TRUSTED_PROXY_HOPS`. Full docs are coming to **[kew.sh](https://kew.sh)**.

</details>

## Security

Kew runs with no auth by default, which is fine for a `localhost`-only setup. The moment it's reachable by anyone else (and `docker run -p` makes it reachable on your host), turn on the login.

Auth in the self-hosted edition is **one shared login**, not per-user accounts: set `KEW_AUTH_PASSWORD` as the password, and optionally `KEW_AUTH_EMAIL` to also show an email field. Everyone who should have access shares that one credential. Already run SSO? Front Kew with your auth proxy and set `KEW_TRUST_PROXY_AUTH=1`. Per-user accounts, roles (RBAC), and single sign-on are part of the upcoming hosted tier.

## License

[Business Source License 1.1](LICENSE) — source-available. Run it, modify it, and self-host it in production freely; you just may not offer Kew to others as a competing hosted or managed service. It converts to Apache 2.0 on the Change Date. See [NOTICE](NOTICE) for trademark and third-party attributions.

<div align="center">
<br>
<sub>Built for the 2am incident and the morning health check. · <a href="https://kew.sh">kew.sh</a></sub>
</div>
