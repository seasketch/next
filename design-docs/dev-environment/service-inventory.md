# Service inventory

> Part of the [2026 campaign record](README.md). Status: inventory, October 2026. This file records what is called today. It is not a plan. [Local services](local-services.md) remains the decision about what to build.

[Index](README.md) · [Strategy](strategy.md) · [Local services](local-services.md)

What a development laptop and the e2e job call, and whether a local stand-in already exists. Taken from the code, from `npm run dev` and `npm run e2e`, and from a working development `.env` in October 2026.

Two callers:

- **Development** is `npm run dev`. It loads `packages/api/.env`.
- **E2E on CI** is the Smoke tests job. It copies `.env.template` over `.env`, then starts `npm run dev -- --ci --profile e2e`. It does not receive the laptop's Lambda ARNs, R2 keys, or queue URL. The Mapbox token is the one extra secret.
- **E2E on a laptop** is `npm run e2e`. The API still loads `packages/api/.env` for any variable the e2e profile does not override, so a laptop run is less isolated than CI.

A local stand-in is **in use** when that caller is pointed at it. **Exists, not wired** means the repo has a local entry point and this machine does not point the API at it. **None** means there is no local entry point.

`npm run dev` starts Postgres, Redis, the API (and its in-process Graphile worker), the client, the data-tables handler, the spatial-uploads handler, the subdivision container, and the bookmark screenshotter. The e2e profile starts only the API, the client, and the screenshotter, on their own ports and on the `seasketch_e2e` database. It points `DATA_TABLES_LAMBDA_DEV_HANDLER` at `http://127.0.0.1:1` so the e2e API will not call the laptop's data-tables handler.

## In use locally

| Service | What it is | Development | E2E | Still leaves the machine |
| --- | --- | --- | --- | --- |
| Postgres + PostGIS | Compose container, port 54321 | In use | In use, database `seasketch_e2e` | No |
| Redis | Compose container, port 6379 | In use | In use, database 1 | No |
| GraphQL API and job worker | Host process. Graphile worker runs inside the API | In use | In use | Whatever the `.env` it loaded names |
| Client | Create React App dev server | In use, port 3000 | In use, port 13000 | Map tiles and Auth0, below |
| Bookmark screenshots | `packages/map-screenshotter` under `wrangler dev`, with Chrome on this machine. `npm run dev` points the API at `http://127.0.0.1:8791`. This is the stand-in added in this campaign | In use. Replaces `SCREENSHOTTER_URL` for that process. The `.env` still has an old Lambda ARN, `SCREENSHOTTER_FUNCTION_ARN`, which this path does not call | In use, port 8792. Test mode keeps the PNG on the API and the client loads it from there, so the bookmark journey does not call Cloudflare Images | The captured page still loads a Mapbox map |
| Login for journeys | `E2E_TEST_MODE` signs tokens with the API's own key. Management lookups use the local `users` table | Off. `npm run dev` does not set test mode | In use. CI holds no Auth0 secret | No |
| Invite and verification email for journeys | `E2E_TEST_MODE` writes the message to `e2e-emails/` | Off. A feature that sends mail uses SES, From `do-not-reply@seasketch.org` | In use | No |

Human login is the non-production Auth0 tenant `seasketch-dev.us.auth0.com`, not the production tenant and not a local server. The laptop `.env` has that tenant's Management secret. The API starts without the secret. Journeys never call Auth0.

## Compute is local; storage and side calls are not

These processes run on the laptop during `npm run dev`. The work they do still reads or writes a cloud service.

| Service | Local process | Development | E2E | Cloud it still uses |
| --- | --- | --- | --- | --- |
| Data-table processing | `packages/data-tables-handler` HTTP server, port 3006. The API calls `DATA_TABLES_LAMBDA_DEV_HANDLER` | In use | Not started. The handler URL is a closed port, so the feature is off | R2 bucket `ssn-tiles`. Public taxonomy proxy `https://uploads.seasketch.org/taxonomy`. Optional: the Geostats PII classifier Lambda, Cloudflare AI Gateway, Slack |
| Spatial uploads | `packages/spatial-uploads-handler` HTTP server, port 3005. The API calls `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER` | In use | The e2e profile does not start it. CI's template leaves the handler unset, so the feature is off. A laptop `.env` still names port 3005, so a local e2e run that uploads would call a server the e2e profile did not start | Data-uploads S3 bucket named in `.env`. R2 bucket `ssn-tiles`. Public hosts `uploads.seasketch.org` and `tiles.seasketch.org`. Optional: the same PII classifier Lambda, Cloudflare AI Gateway, Slack |

## A local entry point exists, and this machine does not use it

| Service | Local entry point | What development calls instead | E2E |
| --- | --- | --- | --- |
| Overlay worker (report metrics) | `packages/overlay-worker/server.ts`. Its default port is 3006, the same port as the data-tables handler. Results are still delivered on SQS | `OVERLAY_WORKER_LAMBDA_ARN` is the deployed `OverlayWorker` function. `OVERLAY_WORKER_DEV_HANDLER` is empty. The API consumes `seasketch-dev-overlay-engine-worker-queue-5` in us-west-2, a shared development queue, and deletes the messages it receives | The template leaves the ARN and the queue unset, so the consumer does not start and the feature is off |
| Subdivision | Compose service `subdivision`, Lambda runtime on port 9000. `npm run dev` starts the container. The README shows a curl against that port | The API invokes `SUBDIVISION_WORKER_LAMBDA_ARN`, the deployed `SubdivisionWorker` function. Nothing points that call at port 9000. Progress comes back on the same SQS queue | Not started. The template leaves the ARN unset, so preprocessing fails if a job reaches it |
| Tiles, downloads, data-table queries | `packages/pmtiles-server` `npm run dev` (`wrangler dev`). Not in the start command | Public hosts `https://tiles.seasketch.org` and `https://uploads.seasketch.org`, backed by R2 bucket `ssn-tiles`. ACL documents on that bucket use a per-developer `TILES_ACL_NAMESPACE`, which is not `prod` | Same public hosts, for fixture layers. CI has no R2 write keys |
| Geostats PII classifier | `make serve` in `packages/geostats-pii-risk-classifier` starts a Lambda runtime on port 9000, the same port as subdivision | `GEOSTATS_PII_CLASSIFIER_ARN`, the deployed `GeostatsPiiClassifier` function. The upload handlers call it when the ARN is set | Template leaves the ARN unset, so classification does not run |

## No local stand-in

| Service | What development calls | E2E |
| --- | --- | --- |
| Sketch fragment worker | `FRAGMENT_WORKER_LAMBDA_ARN`, the deployed `FragmentWorker` function. Unset, the feature throws. The package has no local server | Template leaves the ARN unset |
| Object storage | R2 bucket `ssn-tiles` (tiles and upload outputs) and `ssn-file-uploads` (forum and survey files). S3 data-uploads bucket and `seasketch-next-public-uploads` (CloudFront `d17krkm4g5m2af.cloudfront.net`). Offline tile packages use the bucket named `TILE_PACKAGES_BUCKET` | CI has no write keys. Fixture reads use the public hosts below |
| Cloudflare Images | Account API and `imagedelivery.net`, for forum and survey images. Bookmark captures in test mode do not use it | Bookmark journey uses the API. Other image uploads are not in the current journeys |
| Mapbox | Styles and tiles from `api.mapbox.com`. The map is blank without the token | Same. CI supplies `REACT_APP_MAPBOX_ACCESS_TOKEN`. The screenshotter also needs it to draw the captured map |
| Google Maps | 2D tiles from `tile.googleapis.com`. The API keeps a session with `GOOGLE_MAPS_2D_TILE_API_KEY` | Template has no key. Current journeys use the Mapbox basemaps |
| ArcGIS | The developer's API key, the customer's ArcGIS server, `arcgis-catalog-proxy.underbluewaters.workers.dev`, and `arcgis-export.seasketch.org` | Not used by current journeys |
| Global Fishing Watch | `gateway.api.globalfishingwatch.org`, when a layer's URL is that host | Not used by current journeys |
| Cloudflare AI Gateway | `gateway.ai.cloudflare.com`, for column intelligence and the AI data analyst | Template has no token |
| Cloudflare analytics | GraphQL API at `api.cloudflare.com`, for visitor metrics on `tiles.seasketch.org` | Template has no token |
| Sentry | Ingest host in the laptop DSN, for the client, the API, and the upload handlers | Template has no DSN |
| Unsplash | Unsplash API, for the image picker | Not used by current journeys |
| POEditor | Translation download. Not on the request path of the running app | Not used |
| Slack | Upload-handler notifications | Not used |
| SES | Send from `do-not-reply@seasketch.org`, for any mail outside test mode | File sink, above |

## Public reads

Anonymous reads of public objects are allowed in every profile ([local services](local-services.md)). They are not a local stand-in. The golden snapshot's geography and data-library layers, and the overlay engine's land file, are URLs on `https://uploads.seasketch.org` and `https://tiles.seasketch.org`. Opening `demo-samoa` and its geography in a journey fetches those URLs. `npm run setup` also downloads the snapshot itself from `https://uploads.seasketch.org/golden-snapshot/current/`, with no credentials, and then the dump is a local file.
