# Implemented journeys

The product list of journeys to write is the [campaign catalog](../../design-docs/dev-environment/journeys.md). Iterate that file before farming tests. Offline support in particular waits on a downstream plan named there.

This file is the implementation note for tests that already landed under `packages/e2e/tests`. When a catalog item is implemented, mark it *Covered* in the catalog. Fixture setup, selectors, and teardown stay here or in the spec.

The three `@smoke` journeys stay as they are: an anonymous visitor opens `demo-samoa` and sees the map, `e2e|member` opens `e2e-private` and sees only the Members Forum, and `e2e|admin` opens the `demo-samoa` admin page. They are the only `@smoke` tests. Everything else is the full suite.

Reads use `demo-samoa`. A signed-in user starts mutating journeys as a non-participant unless the spec says otherwise. Joining happens in the test. Each run starts from a restored `seasketch_e2e` snapshot.

A journey that fills in a profile or joins a project does so as an account created for that journey (`disposableUser` in `src/db.ts`, removed again afterwards) or in a project it created, so no journey depends on what another left behind on `e2e|member`.

## Fixture additions (already in the snapshot)

One public forum and one topic on `demo-samoa`. Nothing else was added for the first Playwright set.

- A forum named **Public Forum**, readable by anyone and open for posts by participants.
- One topic in that forum, **Welcome to the project**, with a single post written by `e2e|admin`.

Geography layers, their metadata, the Marine Protected Area sketch class, the default report, Light and Satellite basemaps, and Samoan are already in the snapshot.

## Covered in this package

See the catalog's *Covered* notes. Specs:

- `tests/smoke.spec.ts` — three `@smoke` journeys
- `tests/access.spec.ts` — public, admins-only, invite-only, invites, access requests
- `tests/homepage.spec.ts` — homepage and project listing
- `tests/forums.spec.ts` — anonymous read, join, reply
- `tests/topic-title.spec.ts` — post a topic, length limits
- `tests/map-bookmarks.spec.ts` — forum map bookmark screenshot
- `tests/overlays.spec.ts` — overlay browse, legend, metadata, search
- `tests/basemaps.spec.ts` — Light / Satellite
- `tests/language.spec.ts` — Samoan / English
- `tests/admin.spec.ts` — seed lists on `demo-samoa` admin
- `tests/changelog.spec.ts` — changelog paging
- `tests/uploads.spec.ts` — local spatial uploads
- `tests/local-reports.spec.ts` — drawn sketch, local overlay workers, data-table parquet
- `tests/survey.spec.ts` — Maldives two-sector and Palawan single-sector respondent
- `tests/selective-publish.spec.ts` — selective overlay publish
- `tests/report-overlay-versions.spec.ts` — overlay versions in reports
