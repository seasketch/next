# local-r2

Local stand-in for the two R2 buckets on the data path. There is no
application code to speak of: `wrangler dev` runs this configuration, and
Miniflare serves each bucket over the S3 API at

    http://localhost:8333/cdn-cgi/local/r2/s3/<bucket>/

with SigV4 signatures verified against the credentials in `wrangler.jsonc`.
The API, the upload and data-table handlers, and the subdivision worker talk
to it with the same S3 clients they use against R2. Workers that read the same
objects (`pmtiles-server`, sketch preprocessing) run their own `wrangler dev`
sessions pointed at the same `--persist-to` directory and read through their
R2 bindings. The design is in
[local data services](../../design-docs/dev-environment/local-data-services.md).

| Bucket | Binding | Stands in for |
| --- | --- | --- |
| `ssn-tiles-local` | `TILES_BUCKET` | `ssn-tiles` (published layers, parquet, ACL documents) |
| `ssn-spatial-uploads-tmp-local` | `SPATIAL_UPLOADS_BUCKET` | `ssn-spatial-uploads-tmp` (raw uploads) |

## Running

`npm run dev -- --profile data` starts it with the rest of the stack. On its
own:

```sh
npm run dev --workspace local-r2
```

The launcher prints the `.env` values a process needs to use this storage:

```
R2_ENDPOINT=http://localhost:8333/cdn-cgi/local/r2/s3
R2_ACCESS_KEY_ID=local
R2_SECRET_ACCESS_KEY=local-r2-secret
R2_TILES_BUCKET=ssn-tiles-local
SPATIAL_UPLOADS_BUCKET=ssn-spatial-uploads-tmp-local
```

Those credentials authorize nothing outside this machine. The launcher reads
`LOCAL_R2_PORT`, `LOCAL_R2_PERSIST_TO`, and `LOCAL_R2_IP`; the defaults are
8333, `.data/wrangler` at the repository root, and `0.0.0.0` so containers can
reach it through `host.docker.internal`.

## Persistence

Objects live in `.data/wrangler/` (gitignored) and survive restarts and
reboots. `npm run setup -- --reset` deletes that directory in the same step
that drops the database, so rows and objects reset together. Stop `npm run
dev` first; the reset removes SQLite files out from under a running session.
The e2e profile uses `.data/wrangler-e2e/`.

## Contract test

```sh
npm test --workspace local-r2
```

Starts its own `wrangler dev` on a free port with a temporary persistence
directory and runs each writer's real SDK calls at the shared client factory's
settings: a streamed `PutObject`, `HeadObject`, a ranged `GetObject`, a
`lib-storage` multipart upload, a presigned `PutObject` driven by `fetch` with
its CORS preflight, a presigned `GetObject`, `CopyObject`, `ListObjectsV2`,
`DeleteObjects`, the aws-sdk v2 client, a wrong-secret request that must be
refused, and a read-back through the R2 binding of an object written over S3.
It is the tripwire for a `wrangler` upgrade that renames the experimental
config key or changes how request bodies are handled.

One test asserts that a v3 client *without* `requestChecksumCalculation:
"WHEN_REQUIRED"` is refused. Miniflare does not unframe `aws-chunked` bodies,
which is why the client factories set that option. If that test starts
failing, Miniflare has changed and the option can be reconsidered.

## Known differences from R2

Listed in the design record under *Known differences from S3 and R2*. The ones
that matter day to day: no lifecycle rules (the uploads bucket does not expire
objects on its own), no bucket-level CORS configuration (every response allows
every origin), and `wrangler dev --remote` is not meaningful for this package.
