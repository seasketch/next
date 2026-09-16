# data-tables-handler

Lambda/service that turns overlay Data Table uploads into parquet + column
stats, and runs organism / temporal / nodata reprocess jobs.

## WoRMS local snapshot (for organism enrichment)

Enrichment today still calls the WoRMS REST API through
`/taxonomy/worms/…` (`src/taxonomyApis.ts`). A public parquet snapshot of
[ChecklistBank dataset 2011](https://www.checklistbank.org/dataset/2011)
(World Register of Marine Species, COL package `col-clb-2011`) already
lives on `ssn-tiles` so the handler can resolve AphiaIDs, accepted names,
classification, and vernaculars **without per-taxon HTTP**.
`resolveOrganismTaxa` has not been switched over yet — use
`src/wormsParquet.ts` when you do.

### Where the files are

| Role | R2 | Public HTTP (no map token) |
| --- | --- | --- |
| Accepted taxa | `r2://ssn-tiles/worms/v1/taxa.parquet` | https://tiles.seasketch.org/worms/v1/taxa.parquet |
| Any AphiaID → accepted | `r2://ssn-tiles/worms/v1/ids.parquet` | https://tiles.seasketch.org/worms/v1/ids.parquet |
| Scientific name → accepted | `r2://ssn-tiles/worms/v1/names.parquet` | https://tiles.seasketch.org/worms/v1/names.parquet |
| Build metadata | `r2://ssn-tiles/worms/v1/manifest.json` | https://tiles.seasketch.org/worms/v1/manifest.json |

Constants for these paths, the row types, DuckDB lookups, and
`downloadWormsParquet()` are in `src/wormsParquet.ts`
(`WORMS_PARQUET_VERSION`, `WORMS_*_R2_REMOTE`, `WORMS_PARQUET_PUBLIC_BASE`).

Do **not** store this snapshot under:

- `taxonomy/…` — Worker JWT proxy (`TaxonomyBackend`)
- `dataLibrary/…` — treated as a public PMTiles archive (`.json` → TileJSON)

`worms/` is a public fixture (`x-ss-tile-auth: allow:fixture:public`).
Tiles serve objects with `Cache-Control: public, immutable, max-age=31536000`.
After a new dump, **bump `WORMS_PARQUET_VERSION`** (`v1` → `v2`) instead of
overwriting the same keys.

The handler should prefer `r2://` (`getR2Object` / `downloadWormsParquet`)
over HTTP so a regenerate is visible immediately.

### Schema (what to query)

- **`ids.parquet`**: `aphia_id`, `accepted_aphia_id` — class-table WoRMS ids,
  including synonyms (`282753` → `1702292`).
- **`names.parquet`**: `name_key`, `accepted_aphia_id` — lowercased binomial
  or full scientific name, authorship stripped.
  `Semicossyphus pulcher` → `1702292`.
- **`taxa.parquet`**: one row per **accepted** AphiaID:
  `scientific_name`, `status`, `rank`, `genus`, `family`,
  `ancestor_names[]`, `vernaculars[]`, `common_name`,
  `is_marine` / `is_freshwater` / `is_terrestrial`.

Helpers: `lookupWormsTaxaByAphiaIds`, `lookupWormsTaxaByNames`.

This replaces REST `AphiaRecordByAphiaID`, `AphiaClassificationByAphiaID`,
and `AphiaVernacularsByAphiaID`, plus exact/synonym name match. It does
**not** replace Taxamatch typos (`AphiaRecordsByMatchNames`) or Wikidata
(iNat `P3151`). Licensed dumps often omit AlgaeBase species and some
non-marine taxa — keep REST as a miss fallback.

### Regenerating

Source is a WoRMS / ChecklistBank Darwin Core Archive (extracted folder
with `Taxon.tsv`, `VernacularName.tsv`, `SpeciesProfile.tsv`). Official
bulk dumps: [WoRMS download request](https://www.marinespecies.org/usersrequest.php)
(cite WoRMS; doi:10.14284/170). Taxlist DwC-A from a search export works
the same.

```bash
cd packages/data-tables-handler
npm run worms:build -- /path/to/extracted-dwca
npm run worms:build -- /path/to/extracted-dwca --upload
```

`--upload` uses `.env` R2 credentials (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`) and `putObject` in `src/remotes.ts`. Script:
`scripts/buildWormsParquet.ts`. Fixture tests: `src/wormsParquet.test.ts`
(`testdata/worms-dwca/`).

When switching enrichment over, cache the three parquet files in `/tmp`
for the life of the Lambda invocation (or warmer), query with DuckDB, and
only call `/taxonomy/worms/…` when the snapshot misses.
