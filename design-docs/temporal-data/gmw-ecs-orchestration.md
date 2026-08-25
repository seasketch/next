# GMW library job on EC2 / ECS

Notes from 2026-08-20. Companion to [MRT / raster-array](mrt-and-raster-array.md) and `packages/data-library-gmw`.

## Question

The globe encode is a long-running process. It only needs to run once every couple of months on the latest GMW data. In practice it only needs to **check for new data every 24 hours**, then run processing if there is a change.

What would it take to run this on EC2 / ECS? How could we orchestrate that? Is it a feasible project?

## Answer

Yes — this is a feasible, fairly small ops project. The job already matches what the MRT plan called “workstation now; ECS later,” and it is a much better fit for ECS/EC2 than for Lambda or Graphile Worker.

GMW is a yearly-ish research product (v4.1.2, 1,696 cells), not a daily cube like Coral Reef Watch. Checking every 24 hours is cheap and correct; a full encode should stay rare.

## Why not copy CRW

`updateCRWTemplate` runs every 6 hours in Graphile Worker: list a NOAA directory, download one NetCDF, hand it to the upload Lambda, call `replace_data_source`. Minutes, small files, no GDAL mosaic.

This job is the opposite: tens of GB, GDAL CLI, ~20 min of cell warps, then several hours of encode, then two R2 PUTs. It also **must not** write production metadata — the contract is bytes + a runbook. So it does not need the API VPC, RDS, or Graphile at all.

## What the machine actually needs

From the laptop encode and the first globe:

| Resource | Ballpark |
| --- | --- |
| CPU | 8–16 cores |
| RAM | 16–32 GB is plenty (GDAL subprocesses + streamed packer) |
| Disk | **~80–150 GB** working set: source zip/extract + 1,696 warped cells + ~1.8 GB tile tree + mosaic |
| Time | occupancy ~30 s, warp ~20 min, encode **~6–8 h** (low-zoom multi-cell warps, then ~2.9 tiles/s on the Florida smoke) |
| Output | 2 objects: `display.mrt.pmtiles` (~1.8 GB) + `analysis.tif` (~0.4 GB) |

Fargate’s default 20 GB ephemeral disk is too small. The 200 GB ephemeral option is enough. Lambda is not.

## Orchestration that fits

Two stages, not one fat cron.

```
EventBridge (daily)
    → tiny checker (Lambda, 30s)
        HEAD/ETag or release id vs last processed
        (SSM param or s3://…/dataLibrary/GLOBAL_MANGROVE_WATCH/latest.json)
    → if unchanged: stop
    → if new: ecs:RunTask (or RunInstances)
        download zip → occupancy → warp → encode → pack → analysis
        PUT two objects to R2
        write runbook + Slack “register these URLs”
```

The checker is the 24-hour loop. The heavy task only exists while a new release is processing, then goes away.

`--keep-existing` already makes retries cheap: warped cells and finished tiles stay on disk if you attach EBS/EFS; on Fargate ephemeral you lose them if the task dies.

Do **not** auto-call `replace_data_source`. A Slack/email with the runbook is the right handoff until the Versioning “register hosted products” UI exists.

## Fargate vs EC2

**Fargate first** is the simplest if this lives in AWS:

- Image: Node 20 + GDAL CLI + `packages/data-library-gmw` (and raster-array source).
- Task: 8–16 vCPU, 32 GB, 200 GB ephemeral.
- IAM: write `dataLibrary/GLOBAL_MANGROVE_WATCH/*` on the tiles bucket; no DB role.
- Cost: on the order of **$10/run**, a few times a year.

**EC2 (or ECS on EC2) + gp3** is better if you want resume across days or cheaper spot:

- `m6i.2xlarge` / `m6i.4xlarge` + 200 GB gp3.
- EventBridge → Step Functions → `RunInstances` (or an ECS capacity provider that scales from 0) → userdata runs `npm run build` → terminate.
- Spot + `--keep-existing` on EBS is a good pair; Fargate Spot can interrupt and lose the scratch tree.

You do not need to shard across tasks. Eight hours every few months is not worth splitting XYZ lists and merging archives.

You also do not need the existing Maintenance Fargate service (256 CPU / 512 MB bastion). This is a different task definition.

## What you would actually build

1. **Release detector** — the only product work. GMW does not have a NOAA-style daily index. You need a stable signal: Zenodo record, JAXA/GMW product page, or a hash of the zip URL. Store `{release, etag, processedAt}`.
2. **Dockerfile** — GDAL + the CLI. The pipeline is already a CLI; wrapping it is the main engineering.
3. **CDK** — EventBridge rule + Lambda checker + `FargateTaskDefinition` + `ecs:RunTask` permission. One new stack; no GraphQL/worker changes.
4. **Notify** — Slack with the two public URLs and suggested `TemporalInfo`.
5. **Later (optional)** — EFS for `work/cells-3857` so a crash does not redo the 20 min warp; in-process GDAL if you want to cut wall time.

## Feasibility

This is a **small, well-bounded project** — a few days of infra once the CLI is trusted, not a new platform. The job is already isolated, resumable, and writes two objects. The daily check is a URL comparison.

The parts that are *not* done yet, and matter more than ECS, are: a reliable “is there a new GMW zip?” probe, a Docker/GDAL image, and the admin attach UI (or a manual register from the runbook). You can keep running it on a laptop until those exist; moving the same CLI to Fargate does not change the product.
