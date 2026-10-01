# Integration testing

> Part of the [2026 campaign record](README.md). Status: design, started September 2026.

[Index](README.md) · [Strategy](strategy.md)

## Intent

SeaSketch has solid unit-test jobs and no browser gate. A browser suite serves three purposes:

- **Product risk.** [Multi-level admin capabilities](https://seasketch-feature-proposals.pages.dev/proposals/admin-capabilities/) change access control across the product. That work needs tests that fail when an anonymous visitor, a member, or an admin sees the wrong thing, and those tests must exist before its large changes merge.
- **Reviewable agent work.** Reading the diff is not enough to review an agent's client or API change. A journey that runs in CI, with a trace and screenshots on failure, is the review artifact.
- **Production health.** A small read-only probe runs after each deploy, and later on a schedule, so we learn when the live site is down or a public project will not open.

## Starting point (2026)

API Jest, client Jest, overlay-engine Vitest, schema drift, and generated CSS run on every push. Cypress specs under `packages/client/cypress` describe onboarding, project listing, survey creation, and a production smoke, and a `window.Cypress` branch in the client's token code reads a seeded Auth0 cache. The specs are unmaintained and no longer runnable. The API still has test hooks behind `IS_CYPRESS_TEST_ENV`: invite email written to files, and a short-lived invite for one known address.

## Layers

| Layer | Role | Runs |
| --- | --- | --- |
| Unit and API tests | Breadth. The access-control permission matrix lives here | Existing CI jobs, every push |
| Browser journeys | The paths a person walks, growing from smoke to access, authoring, data, and reports. API tests keep the permission matrix | `@smoke` required on every pull request; broader tags on `master` or nightly until they are cheap enough for pull requests |
| Production probes | Read-only availability of the live site | After every deploy from phase 2; on a schedule from phase 5 |

For admin work, browser coverage means the gates: anonymous visitor, signed-in member, admin, invite acceptance, access request. Who may edit which setting stays in API tests. A suite that repeats a hundred API cases in a browser becomes too slow to gate pull requests, which is the deadlock the [strategy](strategy.md) exists to avoid.

## Runner

Playwright, in a new `packages/e2e` package, driving a real browser against the local API and client. Cypress is not extended. When a Cypress scenario is ported, the behavior (who does what, what they should see) moves; the custom commands and selectors do not.

Journeys are tagged. `@smoke` is about three tests in phase 1:

1. An anonymous visitor opens the public fixture project and sees the map shell.
2. A signed-in user opens a project they just created.
3. An admin opens one admin page.

`@access` arrives in phase 3; `@authoring`, `@data`, and `@reports` in phase 5. `@production` is the read-only probe and never runs against the local stack.

On failure, CI keeps the Playwright trace, screenshots, and the slug of any project the test created. With the slug, a person restores the snapshot locally and opens the same project with a normal non-production login.

## Test-mode auth

Automated runs never log in through Auth0 and store no passwords. The API gains `E2E_TEST_MODE`, which works only when explicitly enabled, only with a shared secret, and never when `NODE_ENV` is `production`.

- **Tokens.** A test-mode login endpoint exchanges a known user and the shared secret for an access token. The API signs it with its own keys — the `jwks` table, `auth/jwks.ts`, and `/.well-known/jwks.json` that already sign invite tokens — under a test-only issuer. `authorizationMiddleware` accepts that issuer only in test mode. Production neither exposes the endpoint nor trusts the issuer, so a leaked test token is useless there.
- **Claims.** Test tokens carry the same `https://seasketch.org/…` claims the Auth0 Action adds, so superuser and email-verified code paths run unmodified.
- **Management API.** Test mode replaces the single Auth0 Management module with a database-backed fake ([Auth0](auth0.md)). Invite acceptance and `canonicalEmail` work for test users who exist in no tenant.
- **Client.** Playwright seeds the Auth0 SDK's localStorage cache so the production bundle runs unchanged. The existing `window.Cypress` branch is removed. If seeding the cache proves unreliable, the fallback is one explicit test-mode branch behind a build flag, recorded in *Decisions*, since that means CI tests a slightly different bundle.
- **Email.** Invite and verification email is written to a workspace directory so a journey can follow the link. This generalizes and replaces `IS_CYPRESS_TEST_ENV`.

Seed users with stable `sub` values live in the golden snapshot. A journey that needs a brand-new user goes through the invite path.

## The golden database

A new laptop, a CI job, and an agent each need a database that already has migration-seeded platform data, signing keys, the data-library rows that geography and clipping depend on, test users, and a few fixture projects. Replaying the full migration history to get there is the slow path this replaces.

**Artifact.** A `pg_dump` custom-format snapshot of schema and data, including Graphile Migrate's bookkeeping, in a private R2 bucket with a small manifest (source migration, creation date, commit). `npm run setup` restores it into the existing PostGIS container, then Graphile Migrate applies only newer migrations. We do not publish a database image with data baked in. A dump fits R2, restores on both amd64 CI and arm64 laptops, and avoids a Compose volume silently hiding data baked into an image. Personal `db:backup` / `db:restore` dumps are unchanged and separate.

**Never from production.** The snapshot is built from a curated non-production database. It contains the API's private signing keys (the `jwks` table), and a production dump would contain user data.

**Who can open a fixture.** Membership rows store a `sub`. A login from any Auth0 tenant creates a new `users` row when that `sub` has not been seen, and that row is not an admin of the fixture projects. The snapshot therefore does not depend on a tenant, and it also does not grant a human login access to those projects.

People and tests reach fixtures by different paths:

- **Anonymous and any signed-in user** can open a public fixture such as `demo-samoa`. No shared account.
- **Automated tests** sign in as seed users whose `sub` values are in the snapshot, through `E2E_TEST_MODE`. Those users exist in no Auth0 tenant. Tests do not use a shared password.
- **Staff** who need to administer a fixture are marked superuser in the non-production tenant. Superuser is a claim, so it applies to whatever `sub` that person has. Their user row does not have to be in the snapshot.
- **Anyone else** creates their own account by signing up on the non-production tenant. A superuser can add that account as an admin of a demo project on that machine. That membership stays in the local database and is gone after `setup --reset`. It is not written into the shared snapshot, because that would pin the snapshot to one person's `sub`.

There is no shared developer password. Fixture owners in the snapshot are synthetic users (the existing `seasketch|root` pattern), not accounts a person logs into.

**Fixtures and isolation.** Fixture projects (`demo-samoa`, plus a few added as journeys need them) are for people and read-only smoke. A journey that mutates creates its own uniquely slugged project and hard-deletes it afterward in SQL, because the GraphQL delete is soft and keeps the slug. Tests never write to `superuser` or `demo-*`. Isolation by project lets journeys run in parallel.

**Refresh.** A maintainer rebuilds and pushes the snapshot after a batch of migrations, and the previous dump stays archived by date and migration. Pull-request jobs and agents may pull but never push. New shared fixture data is its own snapshot-refresh change, not a side effect of a feature pull request.

## What runs when

**Phase 1** (Lerna and CRA unchanged): snapshot create, pull, and restore; `setup`; `E2E_TEST_MODE`; three `@smoke` journeys; a CI job that restores, migrates forward, builds the API and the client production bundle, runs `@smoke`, and is a required status check on pull requests to `master`. Core profile only.

**Phase 2:** `@production` probe — homepage, the public fixture's production equivalent, API health — run by the deploy workflow after each deploy. Read-only, no test mode, no project creation. The existing Cypress production-monitoring spec is its starting inventory.

**Phase 3:** access and onboarding journeys ported from the Cypress onboarding specs — public project, admins-only project, invite-only project, invite acceptance, access request — tagged `@access` and required on pull requests. Cypress, its dependencies, and the `cypress` ESLint plugin are removed, and the repo README stops describing tests that do not run. Data-profile journeys only where an upload or tile is truly the point.

**Phase 4:** no new journeys. The existing ones are the acceptance test for the new client build.

**Phase 5:** authoring (survey, sketch, project admin), then data and reports, each behind its tag. The production probe also runs on a schedule; a production outage never fails an unrelated pull request. A short agent recipe — when to write an API test versus a journey, tags, teardown, screenshots — is linked from the repo `AGENTS.md`.

Journeys that open a map depend on a Mapbox development token. Their assertion is that the map shell is present, not that basemap tiles rendered.

## Decisions

- Playwright; no further investment in Cypress.
- Test-mode tokens are signed by the API's own keys under a test-only issuer.
- *(October 2026)* `E2E_TEST_MODE` is implemented on the API: `POST /e2e/token`, local verification of that issuer, a database-backed Management stand-in, and invite mail written to `e2e-emails/`. The Playwright client and the smoke CI job are still ahead.
- One golden snapshot for laptops, CI, agents, and later staging, built from a curated non-production database.
- *(September 2026)* `npm run snapshot:create` writes a local custom-format dump from a side database, not from a developer's `seasketch` database. The dump contains committed migrations, the graphile-worker schema, `demo-public` (public, owned by `seasketch|root`), seed users `e2e|member` and `e2e|admin` (`e2e|admin` is an admin of `demo-public`), and one generated signing key. `npm run setup` restores it when the target database has no migrations, then migrates forward. `npm run setup -- --reset` is the wipe. The file is gitignored.
- *(October 2026)* The public fixture is `demo-samoa`. It includes the default Light and Satellite basemaps. Its geographies are built the same way the create-project form builds them for Samoa (`MRGID_EEZ` 8445) with offshore and nearshore zones: Exclusive Economic Zone, Territorial Seas, and Offshore. Those layers are cloned from the public templates, filtered to Samoa, nested under Geography layers, and published, and the project region is the EEZ bounds rather than the global default. Samoan (`sm`) is enabled as an alternate language. Google Maps tile sessions are left out of the dump because they expire; `npm run setup` queues `refreshGmapsApiSession` when the database has none, since the worker crontab only requests one during the 01:00 hour.
- *(October 2026)* The dump seeds the `superuser` data library from `packages/api/snapshots/data-library.sql`: a hardcoded Seamounts template, and the coastline, EEZ, and territorial-sea templates that `demo-samoa` clones. Each layer keeps a public tile URL, attribution, and cartography. Seamounts also keeps its citation and click popup. The file does not include the rest of the production catalog or `data_upload_outputs`. `cleanupDeletedOverlayRecords` skips object deletion for `SEAMOUNTS`, `DAYLIGHT_COASTLINE`, `MARINE_REGIONS_EEZ_LAND_JOINED`, and `MARINE_REGIONS_TERRITORIAL_SEA` when `NODE_ENV` is not `production`. `npm run snapshot:publish` uploads the dump to `golden-snapshot/current/` in the private file-uploads bucket (`R2_FILE_UPLOADS_BUCKET`) and keeps the previous object under `golden-snapshot/archive/`. `npm run setup` downloads it when the local copy is missing or older.
- Project-per-journey isolation, hard-deleted in SQL.
- The pull-request gate stays small on purpose. Breadth lives in unit tests and in `master` or nightly browser runs until phases 2 and 4 make pull-request minutes cheap.
- The production probe starts in phase 2, when production artifacts first change.

## Open questions

- *(Phase 1)* Whether seeding the Auth0 SDK cache works with `useRefreshTokens` and `cacheLocation="localstorage"` as configured today, or the build-flag fallback is needed.
- *(Phase 1)* Snapshot size and restore time. If restore dominates the CI job, cache the restored Docker volume on the runner; the dump stays the source of truth.

## Exit criteria

- **Phase 1:** A failing smoke run blocks the merge. A new clone runs `setup`, starts the core profile, and opens `demo-samoa`. A failed run leaves a trace and the slug of any project it created.
- **Phase 2:** Every production deploy is followed by a passing `@production` probe.
- **Phase 3:** Access journeys are required on pull requests. Cypress is gone. Multi-level admin work has API coverage for the permission matrix and browser coverage for the gates.
- **Phase 4:** The same journeys pass on the new client build.
- **Phase 5:** The probe runs on a schedule. The agent recipe is linked from `AGENTS.md`. A journey added in a pull request is reviewable from CI artifacts.
