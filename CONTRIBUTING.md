# Contributing to Kew

Thanks for your interest in Kew. Bug reports, ideas, and pull requests are all welcome.

## Before you start

- **Found a bug or have an idea?** Open an [issue](https://github.com/kew-sh/kew/issues) first so we can discuss it. For anything non-trivial, this saves you from building something that won't be merged.
- **Security issue?** Please do not open a public issue. Email the maintainer (see [kew.sh](https://kew.sh)) so it can be handled responsibly.

## Contributor License Agreement (required)

Kew is open-core: the source is available under the [Functional Source License 1.1](LICENSE), and a commercial hosted tier is built on top. To keep that model viable, every contributor must sign the **Contributor License Agreement** ([CLA.md](CLA.md)) before their first pull request can be merged.

It is a one-time, automated step: when you open a pull request, the **CLA Assistant** bot will ask you to sign by leaving a comment. Signing grants the project steward a broad, sublicensable license to your contribution (so it can ship in both the source-available project and the commercial tier). You keep the copyright to your own work. See [CLA.md](CLA.md) for the full text.

## Development setup

Kew is a Bun monorepo. You need [Bun](https://bun.sh) and Docker (for a local Redis).

```bash
git clone https://github.com/kew-sh/kew
cd kew
bun install

docker compose up -d redis             # or point REDIS_URL at your own
bun --filter '@kew/server' seed        # load realistic sample data
bun run server                         # API + backend on :5399
bun run dev                            # dashboard (Vite) on :5173, proxies /api -> :5399
```

Open the dashboard at **http://localhost:5173** (the Vite dev server, with hot reload). Local settings live in `apps/server/.env` (gitignored); see [`.env.example`](.env.example) for every option.

Want live, moving data to develop against?

```bash
bun run --filter '@kew/server' feed    # a simulated traffic generator (test only)
```

## Before you open a PR

Please make sure the checks the CI runs are green locally:

```bash
bun run typecheck                      # all workspaces
bun test                               # integration tests (needs the Redis above)
bunx biome check .                     # lint + format
```

Match the style of the surrounding code: the codebase favors small, self-documenting functions and is comment-light by default.

## License

By contributing, you agree that your contributions are provided under the terms of the [Functional Source License 1.1](LICENSE) and the [CLA](CLA.md).
