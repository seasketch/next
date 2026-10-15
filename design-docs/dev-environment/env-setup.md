# Environment setup

> Part of the [2026 campaign record](README.md). Status: design, started September 2026.

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
| `npm run dev` | Start the **core** profile in the foreground: Postgres and Redis through Compose, then the API and client plus the watchers a person editing code needs (API TypeScript, Graphile Migrate, GraphQL codegen, Tailwind), and the data-tables, spatial-uploads, and subdivision workers. Restart a process when its code changes. Exit non-zero if any process in the profile dies |
| `npm run dev -- --profile data` | Core plus the [data profile](local-services.md) |
| `npm run dev -- --ci` | The same profile without watchers. The API runs from `dist`, so build first. The data-tables and spatial-uploads servers start once, and subdivision is built and started once. The client starts last, after those ports are open. This is what Playwright starts |
| `npm run dev -- --only <service>` | One service, raw output, no Compose and no log file. What each editor pane runs |
| `npm run logs [-- <service>]` | Follow `.logs/<service>.log`, or every service |
| `npm run status` | One line per service that has a readiness URL, then `docker compose ps` |

`setup` never drops a database that already exists. A clean slate is a separate, explicit command (`npm run setup -- --reset`), because people and agents both need one and both need to avoid wiping a database they meant to keep.

CI and cloud agents run `bootstrap` and `setup`, then start the same processes headlessly: Playwright's `webServer` runs `npm run dev -- --ci`, and an agent runs `dev` in a background shell and reads `.logs/`. They do not use VS Code tasks. Staging runs the same commands with a staging secret profile and its own database.

## Process supervision

There are two kinds of local process, and each gets the tool developers already know for it.

**Containers run under Docker Compose.** Postgres and Redis today; containerized Lambdas such as spatial uploads when the data profile arrives, as Compose `profiles`. The file is `compose.yaml` at the repo root, and it is runtime-agnostic: Docker Desktop, OrbStack, Colima, and Podman all run it. Each service declares a `healthcheck`, and every caller starts them with `docker compose up -d --wait`, which blocks until the checks pass. That is the whole of "Postgres is ready before the API starts." The Postgres check probes TCP only, because the image's entrypoint runs a temporary socket-only server for init scripts before the real one, and it also requires the `graphile` role those scripts create.

**Host Node processes run under `concurrently`.** The API under nodemon, `tsc --watch`, Graphile Migrate watch, the client dev server, GraphQL codegen, and Tailwind watch the working tree, so they run where the editor and `node_modules` are. Putting them in containers on a Mac means a second `node_modules` and file watching that polls or misses events across the bind mount; the edit loop has to feel fine every morning, and that is the loop. One small root script, `scripts/dev.mjs`, holds the service list (name, package directory, dev command, `--ci` command, readiness URL, profile) and hands it to `concurrently`, which prefixes output by service and stops everything when one process fails. `wait-on` orders host processes in `--ci` mode. Neither is a daemon; `npm run dev` is a foreground process, Ctrl-C ends it, and nothing is left running between sessions.

The service list is defined once and consumed three ways: `npm run dev` runs the profile, the editor's tasks run `--only <service>` per pane, and Playwright runs `--ci`. No other file lists the services.

**Logs.** Output is prefixed on stdout and also written to one rotating file per service under `.logs/` (gitignored), 20 MB per file with three generations kept, cleared at the start of each `dev` run. `npm run logs -- api` tails one file; an agent without an editor terminal reads or greps the same files, and CI uploads the directory with the Playwright report. A person working in Cursor or VS Code also gets agent-readable logs from the per-service terminal panes. Metrics and tracing are out of scope. Server logs, the client dev server output, and Playwright traces are the debugging surface.

**Editor.** VS Code tasks are not the contract and nothing starts on folder open. One compound task, `Dev: core`, run from the task menu, starts `npm run dev` in one terminal. After Postgres is healthy it also opens `npm run logs -- client` and `npm run logs -- db-watch`, each in its own full-width terminal. Other services stay in the main terminal. The tasks do not define a second service list.

**Not chosen.** Compose for everything and devcontainers: file watching across the Mac bind mount. PM2: the right shape for agents, but a per-user daemon outside the repo leaves stale processes across checkouts and makes `dev` return immediately. process-compose, overmind, hivemind, mprocs: a binary most Node developers do not have, for a job `concurrently` and the editor already do. Turborepo's `turbo dev` is the recognizable successor if phase 2 adopts it: the per-package scripts are what it would run, and only `scripts/dev.mjs` would go.

## Ports

Every local service has a fixed port, assigned in `compose.yaml` or the service list in `scripts/dev.mjs` and matched by the `*_DEV_HANDLER` values in the non-production profile. Today two defaults collide: the overlay worker's dev server and the data-tables handler both default to port 3006, and the API template points `DATA_TABLES_LAMBDA_DEV_HANDLER` at 3006. The data profile resolves that in one place.

## Watchers and CI

`npm run dev` includes watchers because a person is editing. CI does not need Graphile Migrate watch, Tailwind watch, or codegen watch. Existing CI jobs already fail on schema drift, stale generated hooks, and stale CSS. `--ci` is the same profile with those watchers left out, so a service added to a profile is picked up by CI without a workflow change. Playwright's `webServer` runs it as one command and waits on the client URL, which in `--ci` mode is started only after the API and the data-tables, spatial-uploads, and subdivision ports answer. A later data-profile job selects its services with `E2E_PROFILE`.

Smoke runs against the built API and the client **production build**, so it exercises the bundle that will be deployed. Local `dev` keeps the dev server. If the CRA production build proves too brittle to be the phase 1 gate, CI may temporarily use the dev server; that exception is recorded in *Decisions* and removed by phase 4.

## Staging

Staging is this contract plus three things: a staging secret profile, a database restored from the golden snapshot and not shared with laptops, and a hostname people can open. It lets a change be clicked through before the production deploy workflow runs.

Phase 1 does not stand up staging. It proves the hard part — a clean VM can run `setup` and `dev` with no editor — through cloud agents, which are the first staging-shaped consumer. Phase 5 decides where a shared staging instance runs. The default assumption is a small VM running these same commands. A slimmer deployed stack is acceptable if it still boots from the snapshot and the manifest. The client-only preview workflow is not staging and does not become it.

## Decisions

- Root npm scripts are the interface. Package scripts remain how a package builds and watches itself. Which configuration they load is a named profile from the [secrets manifest](secrets-management.md).
- Postgres and Redis stay on the existing PostGIS image under Docker Compose. Fixture data arrives through snapshot restore, not a custom database image. *(October 2026)* The Compose file is `compose.yaml` at the repo root. Containerized Lambdas join it as profiles.
- *(September 2026)* `npm run setup` starts Postgres and Redis, waits until the `graphile` role exists, and restores `packages/api/snapshots/golden.dump` into an empty database. A database that already has migrations is left in place and only migrated forward. `--reset` drops it first.
- *(October 2026)* Before that restore, `setup` downloads `golden-snapshot/current/` from `https://uploads.seasketch.org` when the local dump is missing or older. No credentials. `npm run snapshot:publish` uploads it to the tiles bucket that host serves.
- *(October 2026)* The smoke job uses the client dev server. Switching that job to the production bundle waits until phase 4.
- *(October 2026)* Readiness is a TCP or HTTP check, not a sleep. For containers it is a Compose `healthcheck` and `up -d --wait`; for host processes in `--ci` mode it is `wait-on` against the dependency's URL.
- *(October 2026)* Containers run under Docker Compose; host Node processes run under `concurrently` from one root script that holds the service list. No process-compose, PM2, overmind, or devcontainer. Chosen over Compose-for-everything because the edit loop's file watching stays native on the host, and over the dedicated supervisors because `concurrently` plus the editor's tasks already cover the contract with tools Node developers recognize. This keeps a later move to Turborepo open.
- *(October 2026)* `npm run dev` is a foreground process with no daemon and no state outside the repo. It exits non-zero when any process in the profile dies.
- *(October 2026)* Logs are prefixed on stdout and written to one rotating file per service under `.logs/`, 20 MB and three generations, cleared when `dev` starts. `npm run logs` tails them. `npm run status` probes each service's readiness URL and prints `docker compose ps`; it is not a dashboard.
- *(October 2026)* CI starts the stack with `npm run dev -- --ci` through Playwright's `webServer`, one command, waiting on the client URL. Profiles select services for later data-path jobs.
- *(October 2026)* `npm run dev`, `npm run dev -- --only`, and `npm run dev:db` do not set `E2E_TEST_MODE` or `E2E_TEST_PASSPHRASE`. A development machine runs a normal API: Auth0 login, the API's ordinary mail path, and no test issuer. The e2e suite supplies those two variables itself, from `packages/e2e/e2e.env`, in the Playwright `webServer` environment when it starts `npm run dev -- --ci`.
- *(October 2026)* Nothing starts on folder open. The editor has one compound task, run manually, that runs `npm run dev` in one terminal and follows the client and database-watch logs in two more. It is a presentation of the same service list, not a second definition.
- Cloud-agent usability is a phase 1 exit criterion. The repo `README.md` describes these commands when phase 1 lands.

## Open questions

- *(Phase 4)* Whether smoke switches from the client dev server to the production bundle before Create React App is replaced. Phase 1 uses the dev server.

## Exit criteria

- **Phase 1:** On a clean machine, `bootstrap`, `setup`, then `dev` reaches a fixture project in the browser. Postgres is ready before the API starts. Logs are filterable by service. CI runs the same `setup` before Playwright. A cloud agent follows the README without anyone exporting variables by hand. *Done, October 2026.*
- **Phase 2:** `bootstrap` is plain `npm install` at the root.
- **Phase 3:** `npm run dev -- --profile data` starts the [data profile](local-services.md) with no port collisions.
- **Phase 5:** A hosted staging environment runs this contract with its own database and secret profile.
