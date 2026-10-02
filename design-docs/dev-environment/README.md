# Development environment

> **2026 campaign record.** Status: design, started September 2026.

This folder records the decisions behind a 2026 campaign to change how SeaSketch is configured, started, tested, and built — on developer laptops, in CI, on cloud agents, and eventually in a staging environment.

## Why

SeaSketch's packaging, local runtime, and tests grew up around 1-2 developers using careful configuration as often as automation, and often shared services with production for development and testing. For a time this was a reasonable tradeoff, but two things now make that untenable:

- **Multi-level admin capabilities** ([proposal](https://seasketch-feature-proposals.pages.dev/proposals/admin-capabilities/)) change access control across the product. That work needs exhaustive testing and CI before its large changes merge. Covering the full surface area with integration tests will require better automation and service isolation.
- **Agent-assisted development** needs a clean machine to boot SeaSketch from documented commands, without production credentials, and needs CI artifacts a person can review.

Both require refactors (Lerna, Create React App) that are themselves too risky to do without the test gate. The [strategy](strategy.md) explains how to address this chicken-and-egg problem.

## Reading order

Start with the [strategy](strategy.md). It is the sequence. Each other file is one decision area. If two files disagree about _what_ to build, the topic file is the record. If they disagree about _when_, the strategy is.

| Document                                            | What it decides                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Strategy](strategy.md)                             | The five phases, their gates, and how the packaging / testing deadlock is broken                                                 |
| [Environment setup](env-setup.md)                   | One setup and startup command for laptops, CI, cloud agents, and staging                                                         |
| [Secrets and configuration](secrets-management.md)  | One manifest of variables, a class for each, and named profiles. The injectors we already use stay (1Password, GitHub, CDK)       |
| [Auth0](auth0.md)                                   | A non-production Auth0 tenant, and an API that does not need Auth0 to boot                                                       |
| [Local services](local-services.md)                 | Which SeaSketch backends run locally, in which profile, and the rule that an unset integration never falls through to production |
| [Integration testing](integration-testing.md)       | Playwright journeys, test-mode auth, the golden database snapshot, and production probes                                         |
| [Monorepo and build](monorepo-and-build-upgrade.md) | npm workspaces, one Node and TypeScript, production build paths, and replacing Create React App                                  |
| [Second production install](second-install.md)      | Out of scope to build. Choices should leave one possible later, as the same revision with a different profile                    |

## Decisions at a glance

Accepted decisions. They describe what this campaign will build, not what is running today. A decision that has shipped is marked with the month. Anything without a month is accepted and still open.

- **Order:** smoke tests on today's toolchain → npm workspaces → access and onboarding journeys → replace Create React App → breadth and staging. One axis changes at a time. ([strategy](strategy.md))
- **Test runner:** Playwright in `packages/e2e`. Cypress scenarios are mined for behavior, then removed. ([integration testing](integration-testing.md))
- **Test auth:** `E2E_TEST_MODE` mints tokens with the API's own signing keys under a test-only issuer. CI holds no Auth0 secrets. ([integration testing](integration-testing.md))
- **Human auth:** a separate non-production Auth0 tenant with its own issuer and audience. The API's Management client is already lazy and optional ([Auth0](auth0.md), September 2026).
- **Database:** a curated `pg_dump` snapshot on R2, restored into the existing PostGIS container, then migrated forward. Never built from production. ([integration testing](integration-testing.md))
- **Startup:** root npm scripts (`setup`, `dev`, `dev:data`, `logs`, `status`) over an existing process manager. VS Code tasks are not the contract. ([environment setup](env-setup.md))
- **Production reach:** an unset integration makes the feature unavailable. Pointing at production is an explicit override, never in CI. ([local services](local-services.md))
- **Secrets:** one committed manifest, named profiles, and existing injectors (1Password, GitHub environments, CDK). No new secrets product. ([secrets](secrets-management.md))
- **Packaging:** npm workspaces with one lockfile. No Nx, Turborepo, or new Lerna. ([monorepo and build](monorepo-and-build-upgrade.md))
- **Client build:** Vite is the candidate replacement for Create React App, accepted only when the existing journeys pass on it. ([monorepo and build](monorepo-and-build-upgrade.md))

## Keeping this record

This is a design record, not an operating manual. Instructions for running the resulting system belong in the repo `README.md`, `ENV.md`, and package READMEs as each phase lands.

- **While the campaign is underway**, correct a decision in place when implementation overturns it, so the archive describes what was actually built. When an open question is resolved, move it into that file's _Decisions_ list with the month and a one-line reason. When a decision ships, add the month to the existing decision. Do not rewrite _Starting point_; that section is the baseline at the beginning of the campaign. Mark a met exit criterion with _Done, <month>_ in place. Do not strike it through.
- **When the campaign is finished**, change every status line in this folder to _archived_, with the date, and stop editing. The rule for what happens after that stays here.
- **If a later refactor replaces these decisions**, it gets its own folder. Add a _Superseded by_ link under the status line above. Do not rewrite these files.

Working notes live outside this folder and are not part of the record. The [Playwright sketch](../../.cursor/plans/e2e_integration_testing_bbbc671b.plan.md) is one; it may go stale.
