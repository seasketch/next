# data-tables-handler

Lambda/service that turns overlay Data Table uploads into parquet + column
stats, and runs organism / temporal / nodata reprocess jobs.

## WoRMS local snapshot (for organism enrichment)

`resolveOrganismTaxa` queries a public parquet snapshot of
[ChecklistBank dataset 2011](https://www.checklistbank.org/dataset/2011)
(World Register of Marine Species, COL package `col-clb-2011`) first,
then falls back to the WoRMS REST API (`/taxonomy/worms/…`) only for
misses (Taxamatch typos, AlgaeBase / non-marine gaps). Wikidata SPARQL
is unchanged.

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

Helpers: `lookupWormsTaxaByAphiaIds`, `lookupWormsTaxaByNames`,
`lookupWormsTaxaByVernaculars`.

Common names with no scientific name are matched against `vernaculars[]`.
Case, diacritics, and hyphens are folded. A name is resolved only when every
hit shares one accepted AphiaID. Two or more species stay unresolved, with
no scientific name and no iNaturalist id. Wikidata is not asked to choose.

This replaces REST `AphiaRecordByAphiaID`, `AphiaClassificationByAphiaID`,
and `AphiaVernacularsByAphiaID`, plus exact/synonym name match. It does
**not** replace Taxamatch typos (`AphiaRecordsByMatchNames`), exact
vernacular misses (`AphiaRecordsByVernacular?like=false`), or Wikidata
(iNat `P3151`). Licensed dumps often omit AlgaeBase species and some
non-marine taxa — keep REST as a miss fallback.

### Regenerating

**Source:** [ChecklistBank dataset 2011](https://www.checklistbank.org/dataset/2011)
— WoRMS as published by Catalogue of Life / ChecklistBank (`packageId`
`col-clb-2011`, this build’s EML `pubDate` 2026-09-01). Download the
Darwin Core Archive from that page, extract it, and point the script at
the folder (`Taxon.tsv`, `VernacularName.tsv`, `SpeciesProfile.tsv`).

Cite both ChecklistBank/COL ([10.48580/d4fd](https://doi.org/10.48580/d4fd))
and WoRMS ([doi:10.14284/170](https://doi.org/10.14284/170)). License on
the DwC-A is CC BY 4.0. The live register remains
[marinespecies.org](https://www.marinespecies.org).

```bash
cd packages/data-tables-handler
npm run worms:build -- /path/to/extracted-dwca
npm run worms:build -- /path/to/extracted-dwca --upload
```

`--upload` uses `.env` R2 credentials (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`) and `putObject` in `src/remotes.ts`. Script:
`scripts/buildWormsParquet.ts`. Fixture tests: `src/wormsParquet.test.ts`
(`testdata/worms-dwca/`).

`ensureWormsParquet()` caches the three files in `/tmp/worms-parquet-v1`
(or `WORMS_PARQUET_DIR`) for the Lambda/dev process, prefers `r2://`,
and falls back to the public HTTP URLs if R2 is unavailable. REST is
used only when the snapshot is missing or a given id/name is not in it.
