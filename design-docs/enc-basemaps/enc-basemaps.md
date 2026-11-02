# S-57 nautical chart basemaps

> Status: proposed November 2026, spike branch `cursor/enc-basemaps-plan-0b67`. The ordered implementation sketch is [`.cursor/plans/enc_basemaps.plan.md`](../../.cursor/plans/enc_basemaps.plan.md). This file is the record and wins where they disagree.

## Intent

Let a SeaSketch project admin upload IHO S-57 electronic navigational chart (ENC) data and get a nautical chart basemap: a good-looking, electronic-chart-system style map that draws from vector tiles hosted by SeaSketch, with a small set of adjustments (palette, units, depth shading, label density, which themes show). Countries and agencies that use SeaSketch bring their own S-57 data. Some of it is licensed to them, so the tiles must be access controlled like any other hosted tile set.

Charts are basemaps, not overlay layers. A basemap is a whole Mapbox GL style with its own sprite, glyphs, and sources, so a tile package with many source layers is fine.

**Not for navigation.** The output is a planning and communication map. It is not a type-approved ECDIS display and does not claim S-52 conformance. The legend and the basemap picker say so.

## Decisions

These were settled in discussion and are the contract for the spike.

- **A new basemap type, `ENC`.** Not a hosted style URL. The basemap row holds the hosted tile URL and a small settings object. The map client generates the style from those settings and a generator version, so adjustments never re-tile and users get live preview.
- **Roll our own pipeline.** GDAL reads S-57. tippecanoe and `pmtiles` build the tiles. A new TypeScript package builds the style. Third-party output is used to ground-truth ours, not to produce ours.
- **Tile access control reuses pmtiles-server.** ENC tiles are hosted under the same `projects/{slug}/public/{uuid}` path and gated by the project ACL document in R2. The basemap's existing ACL row supplies the rule.
- **S-63 is out of scope.** Only unencrypted S-57 is accepted. Encrypted cells are detected and rejected with a clear message.
- **"Good-looking ECS-style" is the quality bar.** S-52 inspired, not conformant. Complex line styles and some conditional symbology are approximated.
- **Phase 1:** upload, tile, store, style, and adjust a project-owned ENC basemap. **Phase 2:** NOAA ENC as a shared basemap kept current by a scheduled job, offered through the data library. **Later:** one basemap built from every open, authoritative S-57 source we can find.

## Non-goals

- S-101 and other S-100 products. The pipeline should detect them and say they are unsupported. Design the normalized schema so S-101 could feed it later.
- Encrypted data (S-63), and any attempt to hold permits, hardware IDs, or keys.
- Offline use of ENC basemaps. They are excluded from offline tile settings until someone designs it.
- ENC features as overlay layers, spatial analysis on ENC data, or reports against it.
- Mariner-specific ECDIS behaviour: alarms, own-ship, route monitoring, safety contour as a navigational control.

## Ground truth and prior art

Rolling our own works only if we can check it. The reference outputs, all unverified until the spike runs them:

- **NOAA ECDIS display service** (WMS and Esri REST). It renders NOAA ENCs with S-52 symbology from the same data we will tile, so it is the closest thing to an answer key.
- **[openwatersio/enc-tiles](https://github.com/openwatersio/enc-tiles)** (Apache 2.0). PMTiles plus MapLibre styles driven by the S-52 Presentation Library as JSON. Useful for symbol and colour tables and as a second opinion on layer taxonomy.
- **[beetlebugorg/tile57](https://github.com/beetlebugorg/tile57)** (MIT, embeds the IHO S-101 catalogue). Official portrayal rules, MVT output with `--format mvt` for `mapbox-gl` 3.4. Used as a second visual oracle only.
- **SMAC-M, njord, OpenCPN.** Prior art for taxonomy and conditional symbology. OpenCPN is GPL; read for understanding, do not copy.
- **IHO S-64 test data sets** for edge cases once the NOAA cells render.

Copyright on the IHO S-52 Presentation Library and the S-101 portrayal catalogue needs a legal read before we ship derived colours, symbols, or lookup tables. Until then the generator uses our own symbol drawings and colour tokens named after S-52 colours but chosen by us, and the plan lists the check as a gate.

## Architecture

```
Admin browser
  create ENC basemap ──► API (presigned PUT, background job, ENC records)
                          │
                          ▼ invoke
              spatial-uploads-handler (Lambda container: GDAL, tippecanoe, pmtiles)
                S-57 zip ─► cells + updates ─► normalized features ─► tippecanoe ─► PMTiles
                          │
                          ▼ R2 (tiles host)                 ▲ ACL doc
Map client ◄── basemap row ── settings + tile URL ──────────┤
  buildEncStyle(settings, catalog) ─► Mapbox GL style       │
  tiles, sprite, glyphs ◄── pmtiles-server (authorizes by project ACL document)
```

### Data model

- `basemap_type` gains `ENC`. For ENC basemaps `basemaps.url` is the hosted tile base URL (`…/projects/{slug}/public/{uuid}`), so the existing hosted-URL helpers and the ACL document builder recognise the UUID with no new path rules. `thumbnail` is generated after the first render.
- A new table `enc_basemaps`, one row per ENC basemap:
  - `basemap_id`, the primary key and foreign key.
  - `settings jsonb`, validated, with `settings_version`.
  - `schema_version`, the version of the tile schema the PMTiles use, so the client can pick a compatible generator.
  - `catalog jsonb`: per-cell name, edition, update number, issue and update dates, producing agency, usage band, compilation scale, vertical and horizontal datum, and a simplified coverage polygon.
  - `bounds`, `minzoom`, `maxzoom`.
  - `source_url`, the retained original S-57 upload in the private uploads bucket, so a pipeline improvement can re-bake without asking the admin to upload again.
  - `pipeline_version`, the handler version that produced the tiles.
- Uploads reuse `project_background_jobs` and `data_upload_tasks`, with `processing_options.kind = "s57"` and the basemap name carried in options. No new job type is needed unless the spike shows otherwise. The basemap row is created when processing succeeds.
- Basemap ACLs already exist (`access_control_lists.basemap_id`, public by default). ENC basemaps use them as they are.

### Processing pipeline

Lives in `spatial-uploads-handler` as a third processor next to vector and raster.

1. **Detect.** A zip containing `.000` base cells, optionally `.001`+ updates and `CATALOG.031`. Read each cell's ISO 8211 header: S-57 proceeds, S-101 is rejected as unsupported, and encrypted S-63 cells are rejected.
2. **Read.** `ogr2ogr` with the GDAL S57 driver per cell, updates applied, soundings split into 3D points with a depth value. GDAL needs its S-57 CSV tables in `GDAL_DATA`; the container already ships GDAL 3.9.2. Check that the S57 driver is present in our build and that the CSVs are installed.
3. **Normalize.** A TypeScript stage maps S-57 object classes to the tile layers below, decodes code lists, computes derived properties, and builds geometry Mapbox GL cannot compute at render time (light sector arcs, buffered symbols where needed).
4. **Quilt.** Overlapping cells at different usage bands are resolved here, not in the style. Each feature keeps its `band`. Lower-band area and line features are clipped by the coverage of higher-band cells within the zoom range where the higher band is shown. The first spike can skip clipping and rely on band-to-zoom ranges.
5. **Tile.** tippecanoe with per-feature layer and zoom hints (`SCAMIN` and band drive minzoom and maxzoom), then `pmtiles convert`. Multi-layer output, one PMTiles per upload.
6. **Publish.** Upload the PMTiles, retain the source zip, emit `catalog.json`, and send the result to `processDataUploadOutputs`, which branches on `kind` and creates the basemap and `enc_basemaps` rows, then rewrites the project ACL document.

**Scale.** The Lambda has a 15 minute limit, 10 GB of memory, and 5 GiB of ephemeral disk. A single cell takes seconds. A national set of hundreds of cells will not fit the 5 GiB scratch space once expanded and tiled. The spike measures where the limit is. If a real upload exceeds it, the processor moves to fan-out per cell and a merge step (Step Functions, or a Fargate task) with the same normalize-and-tile code. The code is written so each cell can be processed on its own and the merge step is separate.

### Tile schema contract (draft, finalised in step 2 of the plan)

One PMTiles per upload, many MVT layers. Layers group S-57 classes by portrayal role. The initial list, to be tested against NOAA cells:

| Layer | Source S-57 classes (examples) |
| --- | --- |
| `depth_area` | DEPARE, DRGARE, UNSARE |
| `depth_contour` | DEPCNT |
| `sounding` | SOUNDG |
| `land` | LNDARE, BUAARE, bridges and structures as areas |
| `coast` | COALNE, SLCONS, shoreline lines |
| `seabed` | SBDARE, OBSTRN areas, UWTROC, WRECKS |
| `hazard` | OBSTRN, WRECKS, UWTROC, points and lines |
| `aid` | LIGHTS, BCN*, BOY*, LITFLT, LITVES, TOPMAR, daymarks |
| `light_sector` | derived arcs and legs from LIGHTS sector attributes |
| `area_regulated` | RESARE, ACHARE, CTNARE, MARCUL, PRCARE, MIPARE, military areas |
| `route` | FAIRWY, TSS*, RECTRC, NAVLNE, DWRTCL, ferry and recommended routes |
| `infrastructure` | cables, pipelines, piers, harbour facilities, dams |
| `place` | SEAARE, LNDRGN, LNDMRK, names and text carriers |
| `coverage` | M_COVR, M_QUAL, used for quilting, "data quality" tinting, and the cell catalogue |

Property rules:

- Raw S-57 attributes keep their delivered acronyms in uppercase (`DRVAL1`, `OBJNAM`, `CATLIT`). Derived properties are lowercase snake_case (`cls`, `band`, `cell`, `depth_min`, `depth_max`, `depth`, `name`, `light_text`, `symbol`). The case tells a reader which are ours, and uppercase matches the standard and the reference tools.
- Every feature carries `cls` (the S-57 acronym), `band` (1 to 6), and `cell`.
- Units are metres for depth and height. Unit conversion is a style concern, never a tile concern.
- MVT has no arrays. List-valued attributes (`COLOUR`, `COLPAT`, `CATWRK`) are written as comma-delimited strings with leading and trailing commas (`,3,4,`) so the style can test membership with a plain substring match. Derived `colors` holds decoded names the same way.
- Enumerated codes stay numeric in the raw property. Derived properties carry decoded labels only when the style needs them.
- Geometry stays WGS 84. Datum differences are recorded in the catalogue, not corrected silently.
- Properties that no style or popup uses (`RCID`, `PRIM`, record pointers, update bookkeeping) are dropped to keep tiles small.
- `scamin` is not an attribute the style reads; it is applied as a zoom range when tiling.

### Style generator

A new workspace package, `enc-style-builder`, laid out like `gl-style-builder`: pure TypeScript, project references, vitest, no `import type`. Public surface:

- `buildEncStyle(settings, catalog)` returns a Mapbox GL style with sources, sprite, glyphs, layers, and a marker layer id for `labelsLayerId`.
- `defaultEncSettings`, `validateEncSettings`, `ENC_SETTINGS_VERSION`, and `ENC_SCHEMA_VERSION`.
- A build script that turns the checked-in SVG symbols into a versioned sprite sheet and builds glyph PBFs from an open-licensed font.

The style is generated from a declarative rule table (S-52 colour token, display priority, symbol key, filter), not hand-edited JSON, so palettes and display categories come out of one source. Settings in the first version:

- Palette: day, dusk, night.
- Display: base, standard, all; individual theme toggles.
- Units: depth (m, ft, fathoms, fathoms and feet), height (m, ft), distance (nm, km).
- Depth shading: two-colour or four-colour, with shallow, safety, and deep contour depths.
- Density: sounding density, label density, symbol size, light sector arcs on or off, honour or ignore `SCAMIN`.

### Client integration

- `MapContextManager` builds the base style for `ENC` basemaps from `buildEncStyle` instead of fetching a style URL. Tile requests go through `authorizeHostedUrl`, so the map access token attaches exactly as it does for protected overlay tiles.
- The basemap picker lists ENC basemaps, with the "not for navigation" note.
- The admin gets an ENC basemap editor: upload, a chart catalogue panel, and the settings panel with live map preview. It extends the existing basemap admin pages in `packages/client/src/admin/data`.
- Touchpoints that read `basemaps.url` and assume a style URL or raster template must handle `ENC`: survey map questions, map bookmarks and the screenshotter, the offline settings pages, the optional layer editor, and the cartography comparison map. The plan lists each as an explicit check.

### Access control

- Hosted ENC tiles are protected the same way as overlay tiles. pmtiles-server finds the UUID in the path, looks it up in `acl/{ns}/projects/{slug}.json`, and checks the map access token's role and groups.
- `buildProjectAclDoc` today reads only published table of contents items. It must also read ENC basemaps: for each basemap with a hosted tile URL, add the UUID to `public` or `protected` according to the basemap's own ACL.
- The ACL document is written when a table of contents is published. Basemaps have no draft state, so writes also happen when an ENC basemap is created, deleted, or has its ACL changed. This is the main server-side change; pmtiles-server itself should need none.
- `Project.hostedTileUuidsRequiringAuth` must include protected ENC basemap UUIDs, or the client will not send the token.
- Uploading requires an attestation that the admin has the right to use and host the data, recorded with the job.

## Phase 2: NOAA ENC as a shared basemap

Shared basemaps already exist: a basemap with no `project_id`, attachable to any project through `projects_shared_basemaps`, created only by superusers. NOAA ENC becomes one of those, owned by the `superuser` project.

- A scheduled job modelled on `updateCRWTemplate.ts` downloads the NOAA all-ENC zip, runs the phase 1 processor, and swaps the tiles. NOAA updates weekly and the all-ENC zip is about 782 MB, so this phase is where fan-out per cell becomes mandatory.
- The tiles live under the `superuser` slug and are public. The `superuser` ACL document must list them in `public` explicitly, because an absent UUID resolves to admins-only.
- The data library gets a card (or a basemap section in the project's basemap settings) that adds the shared basemap to a project. The template id rules in [`packages/api/src/DataLibrary/README.md`](../../packages/api/src/DataLibrary/README.md) apply if it also stamps a template id.
- The golden snapshot gets a tiny fixture ENC basemap, built from a few small NOAA cells, so local development and end-to-end tests have one. Follow `.agents/skills/golden-snapshot/SKILL.md`.
- NOAA data is public domain. Attribute NOAA and state the update date in the basemap attribution.

## Later

A merged basemap of every open, authoritative S-57 source: a source registry per hydrographic office with its licence text, a per-source bake, and a merge that resolves overlaps between offices. This needs a legal review per source and is not scoped here.

## Risks and open questions

- **Style fidelity vs effort.** The rule table is large. The visual diff harness exists to keep the effort bounded and visible. The spike accepts gaps in complex line styles and conditional symbology and lists them.
- **Overlap resolution.** Band-to-zoom ranges alone will look wrong where scales overlap at the same zoom. Clipping by higher-band coverage fixes most of it and is the riskiest part of the pipeline.
- **Lambda limits.** See Scale above. The spike measures a regional bundle.
- **Mapbox GL expressiveness.** Pattern fills, repeated line symbols, and sector arcs are approximated. The generator should record each approximation in a doc, not hide it.
- **Legal.** IHO copyright on S-52 and S-101 artefacts, and the licences of hydrographic offices, need review. Uploaders attest to rights; SeaSketch does not verify them. Public-by-default ACLs on a licensed dataset are a hazard, so the create flow should ask about visibility.
- **Postgres enum change.** Adding a value to `basemap_type` cannot be used in the same transaction that adds it. The migration adds the value alone and the rest of the schema follows in a separate step if graphile-migrate needs that.
- **Fonts and glyphs.** The default base style still uses Mapbox fonts, with a TODO to replace them. ENC glyphs come from an open-licensed font we host.
- **Where static assets live.** The generated sprite and glyph files need a stable public path. The spike picks one (R2 public bucket behind the tiles host is the candidate) and records it.
- **Basemap thumbnails.** Generated from a render of the first cell, or captured with the existing screenshotter once bookmarks are confirmed to work with ENC.
