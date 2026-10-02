# Local services

> Part of the [2026 campaign record](README.md). Status: design, started September 2026.

[Index](README.md) · [Strategy](strategy.md)

## Intent

Daily development, CI journeys, and cloud agents run SeaSketch's own backends on the same machine as the app. A change to uploads, tiles, data tables, or report calculation can be tried without deploying anything. Pointing at a deployed service stays possible for debugging that service, and it is never the default.

[Environment setup](env-setup.md) starts whatever this document puts in a profile. [Integration testing](integration-testing.md) writes journeys only against profiles the start command actually runs.

## Rules

**An unset integration makes the feature unavailable.** The API already behaves this way in places. It skips the overlay-engine queue consumer when the queue URL is missing, and sketch fragment operations throw when `FRAGMENT_WORKER_LAMBDA_ARN` is missing. That becomes the rule for every SeaSketch-operated backend and for Auth0 management ([Auth0](auth0.md)). No variable means a clear error or a disabled feature, never a quiet call to whatever production value was in an old `.env`.

**Production is an explicit override, per integration.** An override is a dedicated variable or flag that cannot be mistaken for a local URL. It is absent from the CI profile and from the default cloud-agent profile.

**Services run locally; public reference data may not.** Fixture projects, data-library layers, and API geography code read public, immutable objects from production hosts by URL — for example `uploads.seasketch.org` FlatGeobufs and `tiles.seasketch.org` archives. Anonymous reads of public objects are allowed in every profile. What the rule forbids is production *credentials* and *writes*: ACL documents, uploads, queue consumption, Lambda invocations. "100% local" means every SeaSketch process a journey depends on is local, not that no request ever leaves the machine.

**Third-party products stay external.** Mapbox, Auth0 (on the non-production tenant), Cloudflare Images, ArcGIS, Google basemap tiles, and public taxonomy APIs are not services SeaSketch runs. Journeys that touch them use development tokens that cannot mutate SeaSketch data, or assert only what does not depend on them.

## Starting point (2026)

VS Code tasks start Postgres, Redis, the API (with its in-process Graphile worker), and the client. Everything else is manual.

| Capability | Package | How a laptop reaches it | Profile |
| --- | --- | --- | --- |
| Postgres + PostGIS, Redis | `packages/api/docker-compose.yml` | Local containers (Postgres on 54321) | Core |
| GraphQL API and job worker | `packages/api` | Local nodemon | Core |
| Client | `packages/client` | Local CRA dev server | Core |
| Data-table processing | `packages/data-tables-handler` | Local HTTP via `DATA_TABLES_LAMBDA_DEV_HANDLER`, started by hand. Package is outside Lerna | Data |
| Spatial uploads | `packages/spatial-uploads-handler` | Docker Lambda runtime via `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER`, or production via `SPATIAL_UPLOADS_LAMBDA_ARN` | Data |
| Tiles, downloads, data-table queries | `packages/pmtiles-server` | Production hosts. `wrangler dev` exists but is not started | Data |
| Overlay worker (report metrics) | `packages/overlay-worker` | Local dev server via `OVERLAY_WORKER_DEV_HANDLER`, but it still reports results through an SQS queue the API consumes; or production via `OVERLAY_WORKER_LAMBDA_ARN` | Data |
| Fragment, subdivision, screenshotter, PII classifier | Matching packages | Deployed Lambdas via `*_ARN`. The screenshotter README describes tunneling a dev client to a deployed Lambda | Optional |
| Email | API `sendEmail` | SES, with a file sink behind `IS_CYPRESS_TEST_ENV` | File sink in every non-production profile |
| AI data analyst | `packages/ai-data-analyst` | Cloudflare AI Gateway token | Optional |

Report calculation is in the data profile, not optional, because report widgets are core product work and the overlay worker already has a local server. Its SQS dependency is the complication. The API receives *and deletes* result messages, so a development API on the production queue would take production results. `OverlayWorkerLambdaStack` already provisions development queues; each non-production environment uses its own.

## Profiles

The start command takes a profile. These names are the contract; flags follow whichever process manager [environment setup](env-setup.md) picks.

- **core** — Postgres, Redis, API, client, and the watchers a person needs. The default for `npm run dev`, CI smoke, and any agent not working on the data path.
- **data** — core, plus the data-tables handler, the spatial-uploads container, `pmtiles-server` under `wrangler dev`, and the overlay worker dev server. The API receives local handler URLs, a development queue, and development buckets. Never Lambda ARNs.
- **optional add-ons** — started one at a time when a task needs them: fragment worker, subdivision worker, screenshotter, PII classifier, AI analyst. Each documents its local command and the variable that points the API at it. Until someone starts one, its feature reports itself unavailable.

In every non-production profile, email is written to a directory in the workspace, generalizing today's Cypress file sink. No default profile sends SES mail.

## Storage

Uploads, tile archives, and ACL documents live in object storage even for local runs. Sharing the production bucket is how a laptop could overwrite a production object or change production access.

**Transitional.** `TILES_ACL_NAMESPACE` already isolates non-production ACL documents on the shared tiles bucket, and the API refuses to run outside production without it or with `prod`. That guard stays in force for as long as a development process can see a bucket production also uses.

**Before phase 3.** Once CI jobs and agents run the data profile, there are too many writers for a namespace convention. Mutable storage moves to development buckets (or prefixes whose credentials cannot write production's). The golden snapshot's private bucket follows the same pattern.

## Decisions

- Existing local entry points — the spatial-uploads Docker image, the data-tables HTTP server, `wrangler dev` for `pmtiles-server`, the overlay-worker dev server — are the data profile. No new service framework.
- The API uses one pattern per integration: `*_DEV_HANDLER` is a local URL, `*_ARN` or a queue URL is a deployed target, and neither set means the feature is off. Phase 1 applies it to everything the core profile touches. Phase 3 wires the data profile.
- Report calculation belongs to the data profile, with a per-environment SQS queue.
- Workers that exist only as deployed Lambdas get a local entry point when a journey or feature task needs one, using the same dev-handler pattern.
- Screenshot generation is stubbed or skipped in core and data profiles.
- *(September 2026)* Outside production, an unset integration stays unavailable. In production, calling that functionality throws `MisconfiguredError` naming the missing variable. The overlay result queue is required before the production process listens, because nothing would fail later if it were missing. `SCREENSHOTTER_FUNCTION_ARN` unset throws before any Lambda invoke.

## Open questions

- *(Phase 3)* Whether the data profile's SQS queue is a per-developer AWS queue (the pattern `OverlayWorkerLambdaStack` already supports) or a local SQS emulator such as ElasticMQ, which would remove AWS credentials from the data profile.
- *(Phase 3)* Whether `pmtiles-server` in the data profile serves from a development R2 bucket through Miniflare, or from local fixture archives.
- *(Phase 3)* Whether the spatial-uploads image build is too slow for pull-request CI. If so, data-profile journeys run nightly or on demand first.
- *(Phase 5)* Which optional workers need a local entry point. Fragment and subdivision are the likely first, if sketch-processing journeys arrive.

## Exit criteria

- **Phase 1:** The core profile starts with no production Lambda ARNs, queue URLs, or Auth0 management credentials, and the features that need them report themselves unavailable.
- **Phase 3:** The data profile runs uploads, data-table processing, tile serving, and report calculation locally against development storage and queues. A developer changes those packages and sees the result without `cdk deploy`. CI data-path journeys use this profile.
- **Throughout:** The production override for each integration is documented for a person debugging production, and absent from CI.
