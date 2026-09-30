# Environment setup

> [2026 campaign record](README.md). Archived when the campaign ends. A later refactor supersedes this folder instead of revising it.

[Index](README.md) · [Strategy](strategy.md)

## Intent

Four consumers need a running SeaSketch, and they get it from the same commands:

1. **Local development** — the common case, and the one that has to work every morning.
2. **CI** — the pull-request smoke job and later journey jobs.
3. **Cloud agents** — Cursor cloud agents or any equivalent: a clean Linux VM with the repo, Docker, and a secret environment. No editor, no personal shell profile.
4. **Staging** — an isolated, shared stack for trying a change before production (phase 5).

There is one contract. CI, agents, and staging are not separate designs.

## Starting point (2026)

Opening the repo in VS Code starts a fixed list of tasks: GraphQL codegen, the client dev server, `tsc --watch` for the API, Graphile Migrate watch, the API under nodemon, `docker compose up -d` for Postgres and Redis, and Tailwind watch. That list is the de facto environment.

- Tasks start together. `db:start` returns when Docker returns, before Postgres accepts connections, so the API and the migration watcher race the database.
- Everything outside that list is a separate, undocumented terminal: spatial uploads, the data-tables handler, the tiles worker, the overlay worker. ([local services](local-services.md))
- Some tasks rely on a shell profile having exported `.env` values. A machine that only has the repo does not.
- Logs are scattered across editor terminals. There is no single place to ask whether the API is up, or to read one service's output.
- The root `package.json` has no scripts. [ENV.md](../../ENV.md) covers variables for the API and client, not how to boot the system.

## The contract

From a clean checkout, with Docker running and secrets injected ([secrets](secrets-management.md)):

| Command | What it does |
| --- | --- |
| `npm run bootstrap` | Install dependencies. In phase 1 this wraps today's Lerna install. From phase 2 it is `npm install` at the root, and the script can go away |
| `npm run setup` | Idempotent. Start Postgres and Redis, wait until Postgres accepts connections, pull the golden snapshot if the local copy is missing or older, restore it into an empty database, and apply migrations newer than the snapshot |
| `npm run dev` | Start the **core** profile in the foreground: API and client, plus the watchers a person editing code needs (API TypeScript, Graphile Migrate, GraphQL codegen, Tailwind). Restart a process when its code changes. Exit non-zero if a required process dies |
| `npm run dev:data` | Core plus the [data profile](local-services.md) |
| `npm run logs` | Follow logs, filterable by service name |
| `npm run status` | One line per service: starting, ready, or exited |

`setup` never drops a database that already exists. A clean slate is a separate, explicit command (`npm run setup -- --reset`), because people and agents both need one and both need to avoid wiping a database they meant to keep.

CI and cloud agents run `bootstrap` and `setup`, then start the same processes headlessly — through Playwright's `webServer` hook or `dev` in the background. They do not use VS Code tasks. Staging runs the same commands with a staging secret profile and its own database.

## Process supervision

VS Code tasks are not the contract. At most, one task calls `npm run dev` so someone who lives in the editor still gets a running app on folder open. Ordering, health checks, and logs live in a process manager that also runs in CI.

The process manager must:

- Declare dependencies with health checks. Postgres and Redis are ready before the API starts; the API is listening before the client or Playwright depend on it. No fixed sleeps.
- Restart code processes using the watch scripts packages already have (`nodemon`, `tsc -w`, the client dev server, `wrangler dev`).
- Prefix every log line with the service name and show one service on request.
- Run without a TTY, with an exit status that reflects a required process crashing.
- Be configured in the repo, including every port.

We will not write one. The phase 1 spike compares process-compose, overmind, and hivemind for the Node processes, keeping the existing Docker Compose file for Postgres and Redis. Docker Compose for everything is the fallback if watch mode and per-service logs prove good enough there. The spike picks one and records it in *Decisions*.

The observability bar is that a person and an agent answer "what is the API doing?" from the same `npm run logs` output. Metrics and tracing are out of scope. Server logs, the client dev server output, and Playwright traces are the debugging surface.

## Ports

Every local service has a fixed port, assigned in the process manager configuration and matched by the `*_DEV_HANDLER` values in the non-production profile. Today two defaults collide: the overlay worker's dev server and the data-tables handler both default to port 3006, and the API template points `DATA_TABLES_LAMBDA_DEV_HANDLER` at 3006. The data profile resolves that in one place.

## Watchers and CI

`npm run dev` includes watchers because a person is editing. CI does not need Graphile Migrate watch, Tailwind watch, or codegen watch. Existing CI jobs already fail on schema drift, stale generated hooks, and stale CSS.

Smoke runs against the built API and the client **production build**, so it exercises the bundle that will be deployed. Local `dev` keeps the dev server. If the CRA production build proves too brittle to be the phase 1 gate, CI may temporarily use the dev server; that exception is recorded in *Decisions* and removed by phase 4.

## Staging

Staging is this contract plus three things: a staging secret profile, a database restored from the golden snapshot and not shared with laptops, and a hostname people can open. It lets a change be clicked through before the production deploy workflow runs.

Phase 1 does not stand up staging. It proves the hard part — a clean VM can run `setup` and `dev` with no editor — through cloud agents, which are the first staging-shaped consumer. Phase 5 decides where a shared staging instance runs. The default assumption is a small VM running these same commands. A slimmer deployed stack is acceptable if it still boots from the snapshot and the manifest. The client-only preview workflow is not staging and does not become it.

## Decisions

- Root npm scripts are the interface. Package scripts remain how a package builds and watches itself. Which configuration they load is a named profile from the [secrets manifest](secrets-management.md).
- Postgres and Redis stay in the existing `packages/api/docker-compose.yml` and PostGIS image. Fixture data arrives through snapshot restore, not a custom database image.
- Readiness is a TCP or HTTP check, not a sleep.
- VS Code tasks shrink to one that runs `npm run dev`, or disappear.
- Cloud-agent usability is a phase 1 exit criterion. The repo `README.md` describes these commands when phase 1 lands.

## Open questions

- *(Phase 1)* Which process manager.
- *(Phase 1)* Whether the CRA production build is reliable enough to be the smoke target from day one.
- *(Phase 1)* How `status` is implemented. Wrap the process manager's own status command; do not build a dashboard.

## Exit criteria

- **Phase 1:** On a clean machine, `bootstrap`, `setup`, then `dev` reaches a fixture project in the browser. Postgres is ready before the API starts. Logs are filterable by service. CI runs the same `setup` before Playwright. A cloud agent follows the README without anyone exporting variables by hand.
- **Phase 2:** `bootstrap` is plain `npm install` at the root.
- **Phase 3:** `dev:data` starts the [data profile](local-services.md) with no port collisions.
- **Phase 5:** A hosted staging environment runs this contract with its own database and secret profile.
