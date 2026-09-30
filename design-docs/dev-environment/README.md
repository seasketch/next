# Development environment

> **2026 campaign record.** Status: design, started September 2026. Not archived. Superseded by: none.

This folder records the decisions behind a 2026 campaign to change how SeaSketch is configured, started, tested, and built — on developer laptops, in CI, on cloud agents, and eventually in a staging environment. It is not about the production infrastructure in `packages/infra` (except where the campaign has to touch how production artifacts are built), and it is not an SDK or anything offered to outside developers.

## Why

SeaSketch's packaging, local runtime, and tests grew up around a few developers and a laptop that already knew how to reach production. Two things make that untenable:

- **Multi-level admin capabilities** ([proposal](https://seasketch-feature-proposals.pages.dev/proposals/admin-capabilities/)) change access control across the product. That work needs a browser test gate before its large changes merge.
- **Agent-assisted development** needs a clean machine to boot SeaSketch from documented commands, without production credentials, and needs CI artifacts a person can review.

Both require refactors (Lerna, Create React App) that are themselves too risky to do without the test gate. The [strategy](strategy.md) explains how that loop is broken.

## Reading order

Start with the [strategy](strategy.md). It is the sequence. Each other file is one decision area. If two files disagree about *what* to build, the topic file is the record. If they disagree about *when*, the strategy is.

| Document | What it decides |
| --- | --- |
| [Strategy](strategy.md) | The five phases, their gates, and how the packaging / testing deadlock is broken |
| [Environment setup](env-setup.md) | One setup and start contract for laptops, CI, cloud agents, and staging |
| [Secrets and configuration](secrets-management.md) | One manifest of variables, classes that decide where a value may appear, and how each consumer is injected |
| [Auth0](auth0.md) | A non-production Auth0 tenant, and an API that does not need Auth0 to boot |
| [Local services](local-services.md) | Which SeaSketch backends run locally, in which profile, and the rule that an unset integration never falls through to production |
| [Integration testing](integration-testing.md) | Playwright journeys, test-mode auth, the golden database snapshot, and production probes |
| [Monorepo and build](monorepo-and-build-upgrade.md) | npm workspaces, one Node and TypeScript, production build paths, and replacing Create React App |
| [Second production install](second-install.md) | A non-goal that constrains choices: nothing here should force a fork to run SeaSketch on another domain |

## Decisions at a glance

- **Order:** smoke tests on today's toolchain → npm workspaces → access and onboarding journeys → replace Create React App → breadth and staging. One axis changes at a time. ([strategy](strategy.md))
- **Test runner:** Playwright in `packages/e2e`. Cypress scenarios are mined for behavior, then removed. ([integration testing](integration-testing.md))
- **Test auth:** `E2E_TEST_MODE` mints tokens with the API's own signing keys under a test-only issuer. CI holds no Auth0 secrets. ([integration testing](integration-testing.md))
- **Human auth:** a separate non-production Auth0 tenant with its own issuer and audience. ([Auth0](auth0.md))
- **Database:** a curated `pg_dump` snapshot on R2, restored into the existing PostGIS container, then migrated forward. Never built from production. ([integration testing](integration-testing.md))
- **Startup:** root npm scripts (`setup`, `dev`, `dev:data`, `logs`, `status`) over an existing process manager. VS Code tasks are not the contract. ([environment setup](env-setup.md))
- **Production reach:** an unset integration makes the feature unavailable. Pointing at production is an explicit override, never in CI. ([local services](local-services.md))
- **Secrets:** one committed manifest, named profiles, and existing injectors (1Password, GitHub environments, CDK). No new secrets product. ([secrets](secrets-management.md))
- **Packaging:** npm workspaces with one lockfile. No Nx, Turborepo, or new Lerna. ([monorepo and build](monorepo-and-build-upgrade.md))
- **Client build:** Vite is the candidate replacement for Create React App, accepted only when the existing journeys pass on it. ([monorepo and build](monorepo-and-build-upgrade.md))

## Keeping this record

This is a design record, not an operating manual. Instructions for running the resulting system belong in the repo `README.md`, `ENV.md`, and package READMEs as each phase lands.

- **While the campaign is underway**, correct a decision in place when implementation overturns it, so the archive describes what was actually built. When an open question is resolved, move it into that file's *Decisions* list with the month and a one-line reason.
- **When the campaign is finished**, change the status line at the top of this file to *Archived* with the date, and stop editing the folder.
- **If a later refactor replaces these decisions**, it gets its own folder. Add its link to the *Superseded by* field above. Do not rewrite these files.

Working notes live outside this folder and are not part of the record. The [Playwright sketch](../../.cursor/plans/e2e_integration_testing_bbbc671b.plan.md) is one; it may go stale.
