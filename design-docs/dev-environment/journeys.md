# Journey catalog

> Part of the [2026 campaign record](README.md). Status: draft for iteration, November 2026.

[Index](README.md) · [Strategy](strategy.md) · [Integration testing](integration-testing.md)

Phase 3 implements two product lists. Iterate the list that matches the interface before farming those tests.

| Catalog | Who it is for | CI job | Tag |
| --- | --- | --- | --- |
| [End-user journeys](journeys-end-user.md) | Visitors, participants, and account holders on the public site and the project map. This is the critical set. | End-user integration | `@enduser` |
| [Admin journeys](journeys-admin.md) | Project admins and superusers inside the admin interface. Important, and a more forgiving bar than the end-user set. | Admin integration | `@admin` |

Smoke is neither of those. It stays one short job and is not split by audience.

Each numbered item is one test, or a tightly related pair that would be misleading to split. One or two sentences describe what a person does and what they should see. It is not Cucumber. Selectors, GraphQL arrange steps, and teardown live in `packages/e2e` when a journey is written.

Existing Playwright coverage is noted in italics. An unmarked item is not yet a journey.

## How the three runs differ

**Smoke.** The three journeys below. Tag `@smoke` only. They do not also carry `@enduser` or `@admin`, so they are not copied into either integration job. Every push. Must stay fast. Do not grow this set.

**End-user integration.** Every item in [journeys-end-user.md](journeys-end-user.md), tagged `@enduser` plus a theme tag. Every branch push. This is the suite that must be green before phase 4 and before a participant-facing change is trusted. A failure here means the product people use is broken.

**Admin integration.** Every item in [journeys-admin.md](journeys-admin.md), tagged `@admin` plus a theme tag. Every branch push, as its own job, so an admin failure cannot hide an end-user failure and the two can be retried on their own. Admin coverage still gets written. A red admin job is a real regression in the admin UI, and it does not carry the same weight as a red end-user job: phase 4 does not wait on an unfinished admin form the way it waits on sketching, surveys, or the map. Bundler-risk that lives in the admin UI (uploads, the style editor, metadata, inserting a report card) is the exception: those rows are part of the phase 4 acceptance test and are called out in each file.

A journey has one suite tag. `@enduser` and `@admin` are never combined. Theme tags (`@sketching`, `@surveys`, `@uploads`, …) are for running one heading locally, not for another CI job. `@bundler` is additive. Sign-in and signup use the test-mode session. No journey calls Auth0 or carries `@auth0`. `@production` is the read-only probe and never runs against the local stack.

Locally: `npm run e2e:smoke`, `npm run e2e:enduser`, and `npm run e2e:admin`. `npm run e2e` runs the folder. CI triggers are in [integration testing](integration-testing.md). None of these jobs are part of Create Deployment.

## Shared rules

**Permission matrix.** Who may edit a setting stays in API tests. End-user journeys cover what a visitor, a member, and a participant can see and walk. Admin journeys cover the admin screens. The gates (anonymous visitor, signed-in non-participant, participant) are end-user even when an admin configured them. Every way into a gated project is [Getting into a project](journeys-end-user.md#getting-into-a-project). Invite-only entry without an invitation is the formal access request: the visitor files it, and an administrator approves or denies it on Users & Groups. The contact email is a follow-up on the gates that show it.

**Arrange without the other suite.** An end-user journey that needs a forum, a layer, or a hidden toolbar sets that up in the database or through GraphQL. It does not click through the admin UI. An admin journey may open the project map only to confirm the thing it just saved. That confirmation does not make it an end-user test.

**Isolation.** Fixture projects (`demo-samoa`, `demo-maldives`, `demo-palawan`, `e2e-private`) are for reads and for smoke. A journey that mutates creates its own project (or a disposable user) and hard-deletes it. Tests never write to `superuser` or `demo-*` except where a read-only fixture is named.

**Offline.** Offline support is a real product surface. Do not farm the offline items in either catalog until a short plan under `.cursor/plans/` says how Playwright takes the browser offline, which service-worker routes are under test, how tile packages are built in the e2e profile, and what is stubbed. End-user offline (cached map, queued survey) is the critical half of that plan. Admin tile packages wait on the same plan.

**Out of scope.** Marketing case-study and use-case pages, legal pages, the developer-API marketing page, and viewport-by-viewport homepage chrome. Numeric overlay accuracy stays in overlay-engine unit tests. The production probe is not a local journey.

---

## Smoke

Intent: prove the app boots, the map loads, and the two seeded personas can enter a project. One of them happens to open the admin page. That does not make smoke an admin suite, and it does not make the other two an end-user suite. These three are only `@smoke`.

1. An anonymous visitor opens `demo-samoa` and sees the map: the basemap response is a Mapbox GL style and the map has fired its load event. *Covered: `tests/smoke.spec.ts`.*
2. `e2e|member` opens `e2e-private`, sees the group-limited Members Forum, and does not see the admins-only forum. *Covered: `tests/smoke.spec.ts`.*
3. `e2e|admin` opens `demo-samoa` and follows Project Admin Dashboard to the admin page. *Covered: `tests/smoke.spec.ts`.*

---

## Bundler-risk index

These must pass on Create React App before phase 4, and on the new build after. The suite column is which integration job owns the row. Smoke does not own any of them.

| | Journey | Suite |
| --- | --- | --- |
| 1 | Spatial upload end to end (worker, WASM, presigned PUT, layer renders). *Mostly covered: `tests/uploads.spec.ts`.* | Admin |
| 2 | Data-table import with columns visible in the editor. *Partial: parquet on local storage only.* | Admin |
| 3 | Report card on a drawn sketch from local overlay workers. *Covered: `tests/local-reports.spec.ts`.* | End-user |
| 4 | ProseMirror forum reply. *Covered.* | End-user |
| 5 | ProseMirror about page and layer metadata. *Missing.* | Admin |
| 6 | GL style editor with autocomplete, save, and map update. *Missing.* | Admin |
| 7 | Map bookmark screenshot. *Covered: `tests/map-bookmarks.spec.ts`.* | End-user |
| 8 | Service worker / offline survey, or a recorded decision to drop it. *Missing; needs the offline plan.* | End-user |
| 9 | A `REACT_APP_*` value reaches the client (so the phase 4 rename is tested, not grepped). *Missing.* | End-user |
| 10 | Report authoring insertion of a ProseMirror card (not SQL). *Missing.* | Admin |
| 11 | Zoom to layer bounds. *Missing.* | End-user |
