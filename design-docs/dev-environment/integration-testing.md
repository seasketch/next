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
| Browser journeys | The paths a person walks, growing from smoke to access, authoring, data, and reports. API tests keep the permission matrix | `@smoke` on every push; broader tags on `master` or nightly until they are cheap enough to run with it |
| Production probes | Read-only availability of the live site | After every deploy from phase 2; on a schedule from phase 5 |

For admin work, browser coverage means the gates: anonymous visitor, signed-in member, admin, invite acceptance, access request. Who may edit which setting stays in API tests. A suite that repeats a hundred API cases in a browser becomes too slow to gate pull requests, which is the deadlock the [strategy](strategy.md) exists to avoid.

## Runner

Playwright, in a new `packages/e2e` package, driving a real browser against the local API and client. Cypress is not extended. When a Cypress scenario is ported, the behavior (who does what, what they should see) moves; the custom commands and selectors do not.

Journeys are tagged. `@smoke` is about three tests in phase 1:

1. An anonymous visitor opens the public fixture project and sees the map.
2. A signed-in member opens a private project they can access through a group ACL.
3. A project admin opens their project and navigates to the admin page.

`@access` arrives in phase 3; `@authoring`, `@data`, and `@reports` in phase 5. *(October 2026)* Phase 3 also carries a small `@bundler` set — one journey each for the surfaces a client build replacement breaks at runtime — tagged by its area as well, so phase 5 grows those tags rather than restarting them. `@production` is the read-only probe and never runs against the local stack.

On failure, CI keeps the Playwright trace, screenshots, and the slug of any project the test created. With the slug, a person restores the snapshot locally and opens the same project with a normal non-production login.

## Test-mode auth

Automated runs never log in through Auth0 and store no passwords. The API gains `E2E_TEST_MODE`, which works only when explicitly enabled, only with the committed passphrase of at least 32 characters, and only when `NODE_ENV` is `development` or `test`. It also refuses a process that holds a production identifier: an RDS database host, or `CLIENT_DOMAIN` set to `seasketch.org`.

- **Tokens.** A test-mode login endpoint exchanges a known `e2e|` user and the committed passphrase for an access token. A token may carry the superuser claim, so superuser journeys run as a test user. Test mode never signs in any other `sub`, so it cannot impersonate a real account in a developer's database. The API signs it with its own keys — the `jwks` table, `auth/jwks.ts`, and `/.well-known/jwks.json` that already sign invite tokens — under a test-only issuer. `authorizationMiddleware` accepts that issuer only in test mode. Production neither exposes the endpoint nor trusts the issuer, so a leaked test token is useless there.
- **Claims.** Test tokens carry the same `https://seasketch.org/…` claims the Auth0 Action adds, so superuser and email-verified code paths run unmodified.
- **Management API.** Test mode replaces the single Auth0 Management module with a database-backed fake ([Auth0](auth0.md)). Invite acceptance and `canonicalEmail` work for test users who exist in no tenant.
- **Client.** Playwright seeds the Auth0 SDK's localStorage cache (`cacheLocation="localstorage"`, `useRefreshTokens`) and the `auth0.<clientId>.is.authenticated` cookie, so the production bundle runs unchanged. The cache key is the client id, audience, and scope that Create React App baked in, including the `offline_access` scope the SDK adds when refresh tokens are on. No refresh token is stored. The access token is still valid, so `getAccessTokenSilently` returns it and does not call Auth0. The `window.Cypress` branch is still in the client; removing it is a follow-up.
- **Email.** Project invite, survey invite, and verification email is written to a workspace directory so a journey can follow the link. Nothing in test mode sends through SES. This generalizes and replaces `IS_CYPRESS_TEST_ENV`.

Seed users with stable `sub` values live in the golden snapshot. A journey that needs a brand-new user goes through the invite path.

## The golden database

A new laptop, a CI job, and an agent each need a database that already has migration-seeded platform data, signing keys, the data-library rows that geography and clipping depend on, test users, and a few fixture projects. Replaying the full migration history to get there is the slow path this replaces.

**Artifact.** A `pg_dump` custom-format snapshot of schema and data, including Graphile Migrate's bookkeeping, in a private R2 bucket with a small manifest (source migration, creation date, commit). `npm run setup` restores it into the existing PostGIS container, then Graphile Migrate applies only newer migrations. We do not publish a database image with data baked in. A dump fits R2, restores on both amd64 CI and arm64 laptops, and avoids a Compose volume silently hiding data baked into an image. Personal `db:backup` / `db:restore` dumps are unchanged and separate.

**Never from production.** The snapshot is built from a curated non-production database. A production dump would contain user data.

**No signing key.** The dump has no rows in `jwks`. `npm run setup` generates a key for each database it restores. A key inside a shared dump would let anyone holding the dump sign invite and test tokens for every install restored from it.

**Who can open a fixture.** Membership rows store a `sub`. A login from any Auth0 tenant creates a new `users` row when that `sub` has not been seen, and that row is not an admin of the fixture projects. The snapshot therefore does not depend on a tenant, and it also does not grant a human login access to those projects.

People and tests reach fixtures by different paths:

- **Anonymous and any signed-in user** can open a public fixture such as `demo-samoa`. No shared account.
- **Automated tests** sign in as seed users whose `sub` values are in the snapshot, through `E2E_TEST_MODE`. Those users exist in no Auth0 tenant. Tests do not use a shared password.
- **Staff** who need to administer a fixture are marked superuser in the non-production tenant. Superuser is a claim, so it applies to whatever `sub` that person has. Their user row does not have to be in the snapshot.
- **Anyone else** creates their own account by signing up on the non-production tenant. A superuser can add that account as an admin of a demo project on that machine. That membership stays in the local database and is gone after `setup --reset`. It is not written into the shared snapshot, because that would pin the snapshot to one person's `sub`.

There is no shared developer password. Fixture owners in the snapshot are synthetic users (the existing `seasketch|root` pattern), not accounts a person logs into.

**Fixtures and isolation.** Fixture projects (`demo-samoa`, plus a few added as journeys need them) are for people and read-only smoke. A journey that mutates creates its own uniquely slugged project and hard-deletes it afterward in SQL, because the GraphQL delete is soft and keeps the slug. Tests never write to `superuser` or `demo-*`. Isolation by project lets journeys run in parallel.

**Database.** `npm run e2e` restores the golden snapshot into `seasketch_e2e` on every run, then starts its own API and client. It does not attach to a dev server already listening, and it does not write to the `seasketch` database a person is using. CI uses that same command. Chromium is a separate download from `npm install`. Once per machine, and again after a Playwright upgrade, run `npm exec --workspace @seasketch/e2e -- playwright install chromium`. The Smoke tests job runs `npx playwright install --with-deps chromium` first.

**Refresh.** A maintainer rebuilds and pushes the snapshot after a batch of migrations, and the previous dump stays archived by date and migration. Pull-request jobs and agents may pull but never push. New shared fixture data is its own snapshot-refresh change, not a side effect of a feature pull request.

## What runs when

**Phase 1** (Lerna and CRA unchanged): snapshot create, pull, and restore; `setup`; `E2E_TEST_MODE`; three `@smoke` journeys; a CI job that restores, migrates forward, builds the API, and runs `@smoke` with the other test jobs. Core profile only. The job is not a deploy gate.

**Phase 2:** `@production` probe — homepage, `www.seasketch.org/fiji`, the Blue Azores survey page (`/blueazores/surveys/23/0`), and public GraphQL for the project list, Fiji, and that survey. Read-only, no test mode, no project creation. The deploy workflow runs it after a successful production deploy and fails the workflow if it fails, without rolling back. The same check runs every 30 minutes from the `production-probe` Worker. Each check waits up to 60 seconds, and a failure is run once more before it posts to `#ssn-notifications` and emails `support@seasketch.org`.

**Phase 3:** access and onboarding journeys ported from the Cypress onboarding specs — public project, admins-only project, invite-only project, invite acceptance, access request — tagged `@access` and run on push with the other tests. Cypress, its dependencies, and the `cypress` ESLint plugin are removed, and the repo README stops describing tests that do not run. Data-profile journeys only where an upload or tile is truly the point.

*(October 2026)* Phase 3 also writes the `@bundler` set, the acceptance test phase 4 runs against the new client build. Each journey exercises something webpack 4 handles today that a replacement handles differently, and each needs the local data profile from [local services](local-services.md):

- Spatial upload end to end: pick a file, the client's web worker inspects it, the presigned upload completes, the layer appears in the table of contents and renders. Covers workers, WASM (`sql.js`, GDAL in the browser if used), and the upload path.
- Data-table import: a CSV upload is processed by the local data-tables handler and its columns appear in the editor.
- Report card: a sketch is drawn and a report tab renders an overlay result from the local overlay worker. Covers the report widgets, ProseMirror node views, and the worker queue.
- Rich-text editors: the about page, a forum post, and layer metadata are edited and saved. Covers ProseMirror and its plugins, which have several nested copies today.
- GL style editor: a layer's style is opened, edited with autocomplete, and saved. Covers CodeMirror and `@lezer`.
- Map bookmark: a bookmark is created and its screenshot is produced. Covers the map screenshotter path and Mapbox GL.
- Service worker: offline survey behavior, if it is still a supported feature; otherwise the decision to drop it is recorded here and the Workbox plugin goes with CRA.
- Environment variables: one journey asserts a value that reaches the client through `REACT_APP_*` today, so the rename in phase 4 is checked by a test and not by reading the bundle.

They pass on Create React App before phase 4 begins. When a phase 4 spike on a throwaway branch finds a surface this list misses, the journey is added here, on CRA, first.

**Phase 4:** no new journeys. The existing ones, including `@bundler`, are the acceptance test for the new client build.

**Phase 5:** authoring (survey, sketch, project admin), then data and reports, each behind its tag. The production probe also runs on a schedule; a production outage never fails an unrelated pull request. A short agent recipe — when to write an API test versus a journey, tags, teardown, screenshots — is linked from the repo `AGENTS.md`.

Journeys that use the map depend on a Mapbox development token. The anonymous smoke is the one that waits until the basemap response is a Mapbox GL style and the map has fired its load event. A later journey waits for that only when a step uses the map. They do not wait for every tile to finish.

## Decisions

- Playwright; no further investment in Cypress. *(October 2026)* The Cypress runner, its dependencies, the `window.Cypress` client branch, and the API's `IS_CYPRESS_TEST_ENV` hooks are removed. The specs under `packages/client/cypress/integration` and the commands they call are kept, unrunnable, as the description of the onboarding and smoke journeys still to port; a spec is deleted when its Playwright journey lands.
- Test-mode tokens are signed by the API's own keys under a test-only issuer.
- *(October 2026)* `E2E_TEST_MODE` is implemented on the API: `POST /e2e/token`, local verification of that issuer, a database-backed Management stand-in, and invite mail written to `e2e-emails/`.
- *(October 2026)* Ten `@access` journeys run in the same push suite. An anonymous visitor opens listed Demo Samoa and sees the map; unlisted E2E Private is not on the project list. An admins-only project tells an anonymous visitor that only administrators may enter, and offers Sign in without Create an account; a signed-in non-admin sees Admins Only; the admin sees the map. An unlisted invite-only project is absent from the list; an anonymous visitor is told an invitation is required and can sign in or create an account; a signed-in non-participant can share a profile and request access. That request stays pending until an admin approves it, and a reload then shows the map. The invite email in `e2e-emails/` is followed by `e2e|member`, who lands on Join Project, skips the profile, and opens the map; the invite status is CONFIRMED. Opened while signed out, that link stays on the invite page, offers Sign In and Create an Account, and leaves the invite unconfirmed. An invite with admin privileges lets `e2e|member` past an admins-only gate. Joining and sharing a profile then opens the admin page. Opened signed out, an admin invite to an email with no account offers Create an Account first and stays unconfirmed. The suite then inserts that `e2e|` user the way a first login does and opens the confirm URL that button returns to; joining and sharing a profile opens the admin page. Each mutating journey creates its own project and hard-deletes it, and deletes a user it created. `e2e|member`'s profile is cleared afterward so the forum journey still sees an empty full name. These journeys do not sign up through Auth0. A signed-in account whose email is not the invite's is told the invitation was sent to the other address, and can accept as themselves. The logout-and-sign-in button is shown and not followed, because that leaves for Auth0. An invite whose token is already expired shows the expired message and stays unconfirmed. The Cypress onboarding specs stay until the remaining scenario, signing up through Auth0, has an equivalent.
- *(October 2026)* The three `@smoke` journeys run from `packages/e2e` against the local client and an API in test mode. An anonymous visitor opens `demo-samoa` and waits for its map to load: the basemap response is a Mapbox GL style and the map has fired its load event. Other journeys wait for that only when a step uses the map. `e2e|member` opens `e2e-private`, an unlisted invite-only project. They are an approved participant and not an admin. A forum limited to their group is visible, and an admins-only forum in the same project is not. `e2e|admin` opens `demo-samoa` and follows Project Admin Dashboard to the admin page. That seed user is a project admin with `share_profile` set, which is the state `create_project` and a finished join leave, and the state the admin UI requires. Sign-in seeds the Auth0 SPA cache above. `npm run e2e` is headless, `npm run e2e:headed` shows the browser, and `npm run e2e:ui` is the interactive runner. The same suite runs on push in the unit-tests workflow, against the client dev server. The Smoke Test Output check lists the journeys. The `playwright-report` artifact is the HTML report, with screenshots, video, and traces when a journey fails. The `window.Cypress` branch remains until a later cleanup.
- *(October 2026)* Test mode signs in only `e2e|` subs, with or without the superuser claim. It runs only under `NODE_ENV` `development` or `test`, with the committed passphrase of at least 32 characters, and refuses an RDS database host or `CLIENT_DOMAIN` `seasketch.org`. The production Auth0 issuer is refused by the env profile ([Auth0](auth0.md)), so test mode does not check it again. Survey invites go to the test mailbox too.
- *(October 2026)* The golden snapshot holds no signing key. `setup` deletes any key a restored dump brings and generates one for that database. The dumps archived on R2 before this change still contain the old shared key.
- One golden snapshot for laptops, CI, agents, and later staging, built from a curated non-production database.
- *(September 2026)* `npm run snapshot:create` writes a local custom-format dump from a side database, not from a developer's `seasketch` database. The dump contains committed migrations, the graphile-worker schema, `demo-public` (public, owned by `seasketch|root`), seed users `e2e|member` and `e2e|admin` (`e2e|admin` is an admin of `demo-public`), and one generated signing key. `npm run setup` restores it when the target database has no migrations, then migrates forward. `npm run setup -- --reset` is the wipe. The file is gitignored.
- *(October 2026)* `demo-maldives` is a second public, listed fixture. Its geography is the Maldives Exclusive Economic Zone (`MRGID_EEZ` 8345) with land subtracted, and its region is that EEZ. It has the default Light and Satellite basemaps and one public survey, Maldives Ocean Use Survey, built by `packages/api/scripts/seed-maldives-survey.js` from `packages/api/snapshots/maldives-ocean-use`. The spatial question uses those two basemaps. The respondent journey is `tests/survey.spec.ts`. That journey selects two sectors before drawing and uses "Finish Sector" between them.
- *(October 2026)* `demo-palawan` is a public, listed fixture with the default Light and Satellite basemaps and no geography of its own. Its Coral Restoration Survey is built by `packages/api/scripts/seed-palawan-survey.js` from `packages/api/snapshots/palawan-coral-survey`. The spatial question has one sector, Coral Recovery Priority Areas, and opens on Palawan via `startingBounds`. The same survey spec covers the single-sector path.
- *(October 2026)* The public fixture is `demo-samoa`. It includes the default Light and Satellite basemaps. Its geographies are built the same way the create-project form builds them for Samoa (`MRGID_EEZ` 8445) with offshore and nearshore zones: Exclusive Economic Zone, Territorial Seas, and Offshore. Those layers are cloned from the public templates, filtered to Samoa, nested under Geography layers, and published, and the project region is the EEZ bounds rather than the global default. Samoan (`sm`) is enabled as an alternate language. Google Maps tile sessions are left out of the dump because they expire; `npm run setup` queues `refreshGmapsApiSession` when the database has none, since the worker crontab only requests one during the 01:00 hour.
- *(October 2026)* The dump seeds the `superuser` data library from `packages/api/snapshots/data-library.sql`: a hardcoded Seamounts template, and the coastline, EEZ, territorial-sea, and high-seas templates the create-project form offers. Each layer keeps a public tile URL, attribution, cartography, and its production `data_upload_outputs` (FlatGeobuf, PMTiles, and the original upload where there is one), which overlay analysis, geography clipping, and downloads read. Seamounts also keeps its citation and click popup. The file does not include the rest of the production catalog. Outside production, `cleanupDeletedOverlayRecords` never deletes an object whose output belongs to the `superuser` project, so a developer's R2 credentials cannot remove these production files. The template ids are listed once, in `packages/api/src/DataLibrary/snapshotTemplateIds.js`. `npm run snapshot:publish` uploads the dump to `golden-snapshot/current/` in the tiles bucket (`R2_TILES_BUCKET`) and keeps the previous object under `golden-snapshot/archive/`. `npm run setup` downloads it from `https://uploads.seasketch.org` when the local copy is missing or older. No credentials.
- Project-per-journey isolation, hard-deleted in SQL.
- *(October 2026)* Smoke and later journeys run on push. They are not required status checks. The push suite stays small on purpose. Breadth lives in unit tests and in `master` or nightly browser runs until phases 2 and 4 make those minutes cheap.
- The production probe starts in phase 2, when production artifacts first change.
- *(October 2026)* The probe is `packages/production-probe`. HTTP and GraphQL checks cover the homepage, Fiji, the Blue Azores survey page, the project list, and survey 23. The same run then opens those screens in one Browser Run session: Sign In on the homepage, the Fiji map's load event, and the survey's Welcome / Begin screen. The map check waits for the canvas, not for tiles. An hourly check was not enough, so the Worker cron runs every 30 minutes. Each check is allowed 60 seconds. A failure is run once more, after a short pause, before anyone is notified. Public runs and the cron share a limit of 20 per hour. A confirmed failure posts to `#ssn-notifications` and emails `support@seasketch.org` through SES. The deploy workflow calls the same Worker and fails the run if the probe fails. It does not roll back.
- Local startup does not enable test mode. `npm run dev` and the other root start commands leave `E2E_TEST_MODE` unset, so a development machine uses Auth0 login and the API's ordinary mail path. Playwright passes `E2E_TEST_MODE` and `E2E_TEST_PASSPHRASE` from `packages/e2e/e2e.env` in the `webServer` environment when it starts `npm run dev -- --ci`. An API that is already running without those variables is not a test-mode API; `/e2e/token` stays unregistered.

## Open questions

- *(Phase 2)* Snapshot size and restore time. Phase 1 is allowed to be slow. If restore dominates the job, cache the restored Docker volume on the runner; the dump stays the source of truth.

## Exit criteria

- **Phase 1:** A push runs the smoke job with the other tests. A new clone runs `setup`, starts the core profile, and opens `demo-samoa`. A failed run leaves a trace and the slug of any project it created. *Done, October 2026.*
- **Phase 2:** Every production deploy is followed by a passing `@production` probe.
- **Phase 3:** Access journeys run on push with the other tests. Cypress is gone. Multi-level admin work has API coverage for the permission matrix and browser coverage for the gates. The `@bundler` set is green on Create React App.
- **Phase 4:** The same journeys, including `@bundler`, pass on the new client build.
- **Phase 5:** The schedule shipped with the probe in October 2026 and now runs every 30 minutes. The agent recipe is linked from `AGENTS.md`. A journey added in a pull request is reviewable from CI artifacts.
