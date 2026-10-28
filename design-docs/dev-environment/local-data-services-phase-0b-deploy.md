# Phase 0b production deploy runbook

This is the checklist for shipping phase 0b of [local data services](local-data-services.md): the `parquet_url` column, stored FlatGeobuf URLs, and one storage client per runtime. The reasons for the order are in [Phase 0b deploy order](local-data-services.md#phase-0b-deploy-order). This page is the commands.

The order is: workers and Lambdas from a laptop, then the GitHub deploy workflow (migrations, API, client). Every worker accepts both what production sends today and what the new API sends, so they can go out in any order among themselves, and nothing breaks while they wait for the API. The API cannot go out before the migration, and the client cannot go out before the API and the sketch-preprocessing Worker. The workflow already enforces migration, then API, then client.

Commands assume the repository is at `~/src/@seasketch/next`. Run each block in one terminal so the exported variables carry through.

## 0. Before you start

- [ ] The phase 0b changes are committed on `master`, including `packages/api/migrations/committed/000449.sql`. Deploy the Lambdas from that commit, not from a dirty tree.
- [ ] `packages/sketch-preprocessing-worker/src/index.js` and `src/utils/fetch-utils.js` are not committed. They are `tsc` output; Wrangler builds from `src/index.ts`. Commit `29ad7ee11` added them. Remove them with:

```bash
cd ~/src/@seasketch/next
git rm --cached packages/sketch-preprocessing-worker/src/index.js packages/sketch-preprocessing-worker/src/utils/fetch-utils.js
rm packages/sketch-preprocessing-worker/src/index.js packages/sketch-preprocessing-worker/src/utils/fetch-utils.js
git commit -m "Remove compiled sketch-preprocessing output"
```
- [ ] Docker is running. `SpatialUploadHandler`, `DataTablesHandler`, and `SeaSketchSubdivisionWorker` build `linux/amd64` images.
- [ ] Wrangler is logged in to the SeaSketch Cloudflare account.
- [ ] Production `overlay_data_tables` has no `parquet_remote` outside `r2://ssn-tiles/`. Checked October 27, 2026: 188 rows, all `ssn-tiles`. The migration refuses to run otherwise.

```bash
cd ~/src/@seasketch/next
git status --short
git log --oneline -1
docker info --format '{{.ServerVersion}}'
(cd packages/sketch-preprocessing-worker && npx wrangler whoami)
```

Record the number of projects that currently show unpublished layer changes. The migration must not change it. On the bastion, in `psql`:

```sql
select count(*) as projects_with_unpublished_changes
from projects
where draft_table_of_contents_has_changes;
```

## 1. Build the workspace

The overlay and fragment Lambdas and the sketch-preprocessing Worker bundle `overlay-engine` from its `dist`. A stale build ships stale code.

```bash
cd ~/src/@seasketch/next
nvm use
npm ci --no-audit --no-fund
npm run build
```

## 2. Load the deploy environment

`cdk deploy -e <stack>` still synthesizes every stack in `bin/infra.ts`, and `GraphQLStack` throws during synthesis unless its variables are set. `packages/infra/.env` holds the values written onto the Lambdas. `packages/api/.env` supplies the rest of what synthesis checks, including `R2_TILES_BUCKET`, which `DataTablesHandler` writes onto its Lambda. Source the API file first so `packages/infra/.env` wins where both set a name. Local values in `packages/api/.env` such as `DATABASE_URL` are not written onto any of the stacks below.

Run this once per terminal, then run the steps below in the same terminal:

```bash
cd ~/src/@seasketch/next/packages/infra
nvm use
set -a
source ../api/.env
source ./.env
set +a
echo "profile=$AWS_PROFILE uploads=$UPLOADS_BASE_URL tiles_bucket=$R2_TILES_BUCKET spatial_uploads=$SPATIAL_UPLOADS_BUCKET"
```

Expect `profile=sls uploads=https://uploads.seasketch.org tiles_bucket=ssn-tiles spatial_uploads=ssn-spatial-uploads-tmp`.

The CDK CLI is not a dependency of `packages/infra`, and `npx cdk` resolves to an unrelated package. The commands below use `npx aws-cdk@2`. CDK shows each change set and asks before applying it; read the IAM changes.

## 3. Workers and Lambdas

### 3a. Subdivision worker

This deploy sets `UPLOADS_BASE_URL` on the Lambda and removes `R2_PUBLIC_BASE_URL`. The handler raises when `UPLOADS_BASE_URL` is unset.

```bash
npx aws-cdk@2 deploy -e SeaSketchSubdivisionWorker
```

- [ ] Check the Lambda's environment:

```bash
fn=$(aws cloudformation describe-stack-resources --stack-name SeaSketchSubdivisionWorker \
  --query "StackResources[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId | [0]" --output text)
aws lambda get-function-configuration --function-name "$fn" \
  --query '{UPLOADS_BASE_URL: Environment.Variables.UPLOADS_BASE_URL, R2_PUBLIC_BASE_URL: Environment.Variables.R2_PUBLIC_BASE_URL, LastModified: LastModified}'
```

Expect `UPLOADS_BASE_URL` to be `https://uploads.seasketch.org` and `R2_PUBLIC_BASE_URL` to be `null`.

### 3b. Spatial uploads and data tables handlers

Both now refuse to write or delete outside the buckets named in their own environment. That check has to be live before the new API sends them cleanup or write work. Both are slow image builds.

The `deploy:upload-handler` script in `packages/infra` calls a `deploy:post` script that no longer exists, so run CDK directly:

```bash
npx aws-cdk@2 deploy -e SpatialUploadHandler
npx aws-cdk@2 deploy -e DataTablesHandler
```

- [ ] Check that both functions updated:

```bash
for stack in SpatialUploadHandler DataTablesHandler; do
  fn=$(aws cloudformation describe-stack-resources --stack-name "$stack" \
    --query "StackResources[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId | [0]" --output text)
  aws lambda get-function-configuration --function-name "$fn" \
    --query '{Function: FunctionName, LastModified: LastModified, BUCKET: Environment.Variables.BUCKET, TILES_REMOTE: Environment.Variables.TILES_REMOTE}'
done
```

Expect `BUCKET` to be `ssn-spatial-uploads-tmp` and `TILES_REMOTE` to be `r2://ssn-tiles` on both.

### 3c. Overlay and fragment workers

The new API passes a URL as `source`. These workers accept a URL and still accept a bare key, so they keep working against the current API.

```bash
npx aws-cdk@2 deploy -e SeaSketchOverlayWorker
npx aws-cdk@2 deploy -e SeaSketchFragmentWorker
```

- [ ] Check that both functions updated:

```bash
for stack in SeaSketchOverlayWorker SeaSketchFragmentWorker; do
  fn=$(aws cloudformation describe-stack-resources --stack-name "$stack" \
    --query "StackResources[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId | [0]" --output text)
  aws lambda get-function-configuration --function-name "$fn" --query '{Function: FunctionName, LastModified: LastModified}'
done
```

### 3d. Sketch-preprocessing Worker

The new client sends `fgbUrl` as the clipping dataset. The Worker in production today treats that string as an object key. The new Worker accepts a URL and still accepts the bare key that a browser on the old client sends. This Worker is not in CDK and does not need the sourced environment.

```bash
cd ~/src/@seasketch/next/packages/sketch-preprocessing-worker
npm run deploy
npx wrangler deployments list | head -n 20
```

- [ ] In production, on the current (old) client, draw a sketch in a project whose sketch class clips to a geography. It should clip as before. This checks that the new Worker still accepts bare keys.

## 4. Push and run the production workflow

The workflow runs migrations, then deploys the API, then checks the live schema against the client's operations, then deploys the client. `migrate.sh` checks out the workflow commit on the bastion, so the commit has to be on GitHub.

Expect a few minutes of clipping errors between the end of the migration and the new API going live. The running API selects `object_key` from the clipping helpers, which now return `fgb_url`, so geography clipping and sketch saving fail until "Deploy Server" finishes. Everything else keeps working.

Before you start it, open a production project in a browser tab and leave that tab alone. You will use it in step 5 as the browser that has not reloaded.

```bash
cd ~/src/@seasketch/next
git push origin master
gh workflow run deploy.yml --ref master -f force=false -f environment=production
sleep 10
gh run watch "$(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

- [ ] "Run DB Migrations", "Deploy Server", "API ready for client", "Deploy Client", and "Production probe" all ran and succeeded. If "Run DB Migrations" was skipped, the workflow did not see `000449.sql` as new; stop and check before the API deploys.

## 5. Verify production

### Database

On the bastion, in `psql`:

```sql
-- Every row has a stored URL.
select count(*) as rows, count(*) filter (where parquet_url is null) as missing_url
from overlay_data_tables;

-- The URL is the uploads origin plus the remote's key.
select parquet_remote, parquet_url from overlay_data_tables order by id desc limit 3;

-- Must equal the count recorded in step 0.
select count(*) as projects_with_unpublished_changes
from projects
where draft_table_of_contents_has_changes;

-- Clipping helpers return a full URL.
select id, fgb_url from clipping_layers_for_geography(
  (select project_geography_id from geography_clipping_layers limit 1)
);
```

Expect `missing_url` to be 0, URLs like `https://uploads.seasketch.org/projects/...`, an unchanged project count, and `fgb_url` starting with `https://`.

### GraphQL

Set `SLUG` to a public project that has geographies:

```bash
SLUG=replace-with-a-public-project-slug
curl -s https://api.seasket.ch/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"query($slug:String!){projectBySlug(slug:$slug){geographies{name clippingLayers{id fgbUrl objectKey}}}}","variables":{"slug":"'"$SLUG"'"}}' \
  | python3 -m json.tool
```

Expect `fgbUrl` to be `https://uploads.seasketch.org/...` and `objectKey` to be `r2://ssn-tiles/...` for the same layer. `objectKey` is what browsers on the old client still read.

### In the browser

- [ ] **Browser that has not reloaded.** In the tab opened before step 4, draw a sketch that clips to a geography. It should save and clip. That tab is still running the old client against the new API.
- [ ] **Fresh browser.** Reload, or use a private window, and do the same. The new client sends `fgbUrl` to the sketch-preprocessing Worker.
- [ ] **Reports.** Edit a sketch in a project with report cards and confirm metrics recalculate. This exercises the overlay and fragment workers with URL sources.
- [ ] **Data tables.** Open a layer with a data table and confirm the table and its visualization load from `parquet_url`.
- [ ] **Uploads.** Upload a small spatial file to a test project and confirm it processes. If you can, also upload a data table to that project's layer. Each confirms its handler writes under the new bucket rule, and the subdivision step reports `publicUrl`.
- [ ] Check Sentry and `#ssn-notifications` for new errors from the API, the Lambdas, and the sketch-preprocessing Worker.

## Rolling back

- **Workers and Lambdas.** Each one accepts what the old API sends, so you can roll one back alone: check out the previous commit, rebuild, and rerun that stack's deploy command, or `npm run deploy` for the sketch-preprocessing Worker.
- **Client.** The new API still serves `objectKey`, so redeploying the previous client is safe.
- **API.** Do not roll back the API alone after the migration. The migration renames the clipping helpers' output column from `object_key` to `fgb_url`, and the old API reads `object_key`, so geography clipping and sketch saving would fail. Fix forward. If you have to go back, first write a new migration that restores the old clipping functions.
- **Migration.** The migration is additive apart from that rename. Leaving `parquet_url` in place is harmless to old code.
