# Organism identity for Data Tables

Data Tables are the way SeaSketch attaches monitoring observations — usually species density or size, sometimes water quality or visitor counts — to a sites/features layer. Thematic maps (bubble charts) already join aggregated parquet rows onto those features and follow the timeslider. What they cannot do yet is treat a `classcode`, `Common_Name`, or `scientificname` column as **organisms**.

This document is the architecture for identifying those columns, optionally enriching them from a class/species table, resolving taxa against public APIs, and searching the result from an Organism Selector and (later) the overlay search bar.

Related: [Temporal Data](../temporal-data/temporal-data.md) · [pmtiles-server Data Tables](../../packages/pmtiles-server/README.md)

**Non-goals for v1:** per-value manual taxon overrides, any integration with report widgets

---

## Goals

- Admins can mark one observation-table column as the organism identity (`classcode`, `Common_Name`, `scientificname`, …).
- An optional class/species CSV can be used **for that enrichment run** to attach scientific names, common names, higher taxonomy, provider ids, and description-like notes. The CSV is not retained.
- Enrichment also works with **no class table** when the observation column already has useful values (binomial or common name).
- Every distinct filter value — including substrate and lumped categories — ends up in a catalog sidecar. `boulder` is as valid as `bryozoan`.
- End users get an Organism Selector (replacing the generic string filter on that column) that searches scientific name, common name, codes, higher taxa (“rockfish”), and class-table descriptions.
- Overlay search can find Data Tables by organism (“Sheephead”) without the user knowing the monitoring folder structure. Choosing a hit turns on the layer, activates that table, and applies the filter.
- Map queries stay what they are today: `q.classcode=SPUL` or `q.classcode=in.(…)`.
- Almost no organism payload in Postgres. The client never downloads the catalog.

---

## Why the client must not search iNaturalist live

iNaturalist `/v1/taxa/autocomplete` is built for _global_ name completion, not “values in this monitoring table.”

Checked 2026-09-11:

- `q=sheephead` does not return California Sheephead. Top hits are Freshwater Drum, Sheepshead (`Archosargus probatocephalus`), hogfishes. California Sheephead is `Bodianus pulcher` (synonym `Semicossyphus pulcher`), iNat taxon `1439813`. It _does_ resolve if you search the scientific name or go by id.
- `q=rockfish` returns Striped Bass first (`matched_term: "Rockfish"`), then Caribbean groupers, then family Scorpaenidae, then genus `Sebastes` (“Rockfishes”).

A user typing “Sheephead” or “Rockfish” in KFM must hit **this table’s** classcodes (`SPUL`, the various `SEB*` / rockfish codes), not a global best-guess. That requires a local catalog whose search text includes class-table names **and** ancestor names copied at enrichment time.

---

## Identity shapes (from CA MPA monitoring)

In-scope datasets from the California MPA Monitoring brief, and how organism identity actually appears.

### Kelp Forest — PISCO / KFM

[doi:10.25494/P6/MLPA_kelpforest.12](https://opc.dataone.org/view/doi%3A10.25494%2FP6%2FMLPA_kelpforest.12). Tables: Fish transects, Uniform point contact, Swath, Invertebrate size.

- Observation identity: `classcode` (e.g. `SPUL`).
- Shared class table: `MLPA_kelpforest_taxon_table` — `classcode` → genus, species, common name, sample type, category (UNDERSTORY KELP, RED ALGAE, substrate), plus protocol notes / size cut-offs (description-like fields).
- Same class table enriches four observation tables. Each table still gets **its own** catalog sidecar (the CSV is re-supplied per run, or the admin reprocesses later).
- UPC mixes organisms and non-taxa (`boulder`, bare rock, relief). All stay in the catalog and the selector.
- Replication (zones, transects, levels) is already a query-engine aggregation concern (`op=sum` on `count`), not an organism concern.

### Nearshore fishes — CCFRP

[urn:uuid:e90ef5b2-03db-4824-8302-35503e096201](https://search.dataone.org/view/urn%3Auuid%3Ae90ef5b2-03db-4824-8302-35503e096201). Tables: Derived Effort, Derived Length.

- Observation identity in the derived tables: `Common_Name` (“California Sheephead”, “Bocaccio”). The PDF’s “variable selector” is exactly this column.
- Optional class table `CCFRP_species_table.csv` (in the DataONE/GitHub package):

  `Species_Code, Common_Name, Scientific_Name, Kingdom…Genus, Species, taxanomic_source, taxanomic_id, species_definition`

  `taxanomic_source` is WoRMS; `taxanomic_id` is an AphiaID (`272286` for Northern Anchovy). `species_definition` is a description field to map as **description**.

- Older `Fish Species.csv` adds a `Rockfish` boolean — useful extra search text, not required if WoRMS/iNat ancestry is resolved.
- Enrichment can run on `Common_Name` alone. Attaching the species table is better (AphiaIDs + definitions).

### Intertidal — MARINe / PISCO

Cover, seastar/abalone density, mobile inverts, photo-plot assemblages. Class tables such as `cbs_species_table` already carry `final_classification`, `species_lump`, WoRMS `taxonomic_id`, and full classification. Map `taxonomic_id` as the WoRMS role. Lumps stay searchable. Substrate and cover classes stay visible.

### Estuary — EMPA

Many tables. Organism-bearing ones (BRUVs, Fish Seines, Crab Traps, Macroalgae, Marsh Plain Vegetation, Benthic Infauna) typically have `scientificname` or an equivalent **in the observation table**. Enrichment with no class table. SCCWRP templates also ship lookup-list tabs if an admin wants them.

Not organism columns: Trash and Microplastics, Feldspar, Sediment Grainsize, Sediment Chemistry. Leave the generic filters. `xx/xx/xxxx` dates are a [temporal](../temporal-data/temporal-data.md) problem.

### Mid-depth rock

Fish Mean Density / Size / Biomass. Species names, sometimes with an ROV lookup CSV. Site identity (`MPA_Group + Type + Designation`, missing sites) is a **join-column** problem, not organism identity.

### Sandy beach / surf zone

[urn:uuid:9ea66d7e-ddbe-4acc-a78e-902d6d19fd4b](https://search.dataone.org/view/urn%3Auuid%3A9ea66d7e-ddbe-4acc-a78e-902d6d19fd4b). Fish and bird tables get an organism column. People counts and physical metrics do not. Inconsistent `site_code` is a join problem.

### Out of scope (same architecture if added later)

RCCA, Bull Kelp (NorCal), HAB phytoplankton, CalCOFI, deep-water ROV. HAB names resolve better on WoRMS than iNat; photos will often be missing.

---

## Taxonomy APIs (researched 2026-09-11)

Two providers. Neither is the search backend for the selector or overlay search.

### iNaturalist — vernaculars and photos

- Docs: [API recommended practices](https://www.inaturalist.org/pages/api+recommended+practices), [taxa API](https://api.inaturalist.org/v1/docs/#!/Taxa).
- **Id → taxon (and photo) is supported.** `GET /v1/taxa/{id}` accepts comma-separated ids, **maximum 30**. Response includes `name`, `preferred_common_name`, `rank`, `ancestor_ids`, `ancestors[]` (name + common name per rank), and `default_photo` (`square_url`, `medium_url`, `license_code`, `attribution`).
- Confirmed for California Sheephead: `GET /v1/taxa/1439813` → `Bodianus pulcher`, preferred common name “California Sheephead”, `default_photo` on `inaturalist-open-data.s3.amazonaws.com`, `license_code: cc-by-nc`. Wikipedia summary still mentions the `Semicossyphus` synonym. iNat’s `preferred_place_id` can bias vernaculars toward a region (California is place **14**); **do not set it on enrichment or runtime queries.** This pipeline is global. If a later revision wants regional common names, pass a place derived from the project’s geography — never a hardcoded CA id.
- **Name search is the wrong tool, even during enrichment.** `GET /v1/taxa?q=` is one name per request at ~1 rps and 429s well before a KFM-sized class table finishes. Do not use it to mint ids.
- **Ids come from Wikidata, then the iNat id batch.** After WoRMS, SPARQL `query.wikidata.org` in batches of ≤50: P850 (AphiaID) and P225 / English `rdfs:label` / P1843 (names) → P3151 (iNat taxon id). Then `GET /v1/taxa/{ids}` (≤30). If a hit is inactive, follow `current_synonymous_taxon_ids` (Wikidata still has `Semicossyphus pulcher` → 53699; iNat points that at `Bodianus pulcher` 1439813).
- **Rate limits (official, iNat):** keep about **1 request/second**, ~60/min preferred, hard-ish throttle **100/min**, **~10,000 requests/day**. The enrichment job should only hit iNat’s id endpoint. Wikidata is a separate SPARQL quota (User-Agent required; serial batches of 50).
- 700 distinct codes, **batched by 30**, is ~24 iNat id requests ≈ half a minute at 1 rps — acceptable **once**, not on every wizard keystroke. Cache every request by `(provider, endpoint, params)`.
- Photos are **user-owned**. Default upload license is CC BY-NC. `license_code: null` + `static.inaturalist.org` means all rights reserved — do not display those. Always show `attribution`. SeaSketch display in the app is a reasonable CC BY-NC use; do not republish photos into our own CDN.
- There is no reliable public “AphiaID → iNat id” field on the taxa payload (`taxon_schemes_count` is not a crosswalk). After WoRMS gives an accepted scientific name, search iNat by that name.

### WoRMS — marine nomenclature

- REST: `https://www.marinespecies.org/rest/`.
- **No photo API.** Classification, accepted name, synonyms, vernaculars, external ids only.
- Useful calls: `AphiaRecordsByName/{name}`, `AphiaRecordsByMatchNames` (up to **50** scientific names), `AphiaRecordByAphiaID/{id}`, `AphiaClassificationByAphiaID/{id}`, `AphiaVernacularsByAphiaID/{id}`.
- Confirmed: `AphiaRecordsByName/Bodianus pulcher` → AphiaID `1702292`, accepted, family Labridae. Classification walks Biota → Labridae → _Bodianus_ → \*Bodianus pulcher`.
- No published hard rate limit. Community clients batch ~50 and retry politely. Still cache.
- CCFRP and MARINe already ship AphiaIDs. Prefer those over name match.

### How the two are used

| Job                                                                         | Provider                                |
| --------------------------------------------------------------------------- | --------------------------------------- |
| Accept / correct a scientific name; classification; AphiaID                 | WoRMS                                   |
| Preferred English common name; ancestor common names (“Rockfishes”); photos | iNaturalist                             |
| Search-as-you-type in the map                                               | **Neither** — `orgQuery` on the search index |

If a value has no scientific name and no AphiaID (substrate, “Red algae”, some lumps), skip APIs. Catalog it from the class table / raw value only.

---

## Architecture

```
Admin enrichment                         Runtime (map)
─────────────────                        ─────────────
observation parquet                      Organism Selector
        │                                Overlay search
optional class CSV                              │
        │                                       ▼
 column-role wizard ──► API cache      GET /orgQuery?tables=…&q=
        │              (iNat, WoRMS)            │
        ▼                                       ▼
  catalog + search index               hits (value, names, ids)
  (R2; worker reads the index)                  │
        │                          ┌────────────┼────────────┐
 OrganismInfo jsonb                ▼            ▼            ▼
 (tiny; Postgres)           visible thumbs   q.col=in.(…)  activate
                            GET /v1/taxa/ids   (existing    layer +
                            (batched)          /query)      table
```

**Postgres stays thin.** One small `OrganismInfo` document on `overlay_data_tables`, same idea as `temporal`. No organism FTS. No search-document table. Do not extend `search_overlays`.

**The catalog is large.** The client never fetches it. It is the source of truth for a full organism row (descriptions, ancestry, ids). **`orgQuery` does not scan it.** Enrichment also writes a compact, field-weighted search index (see [Precomputed search index](#precomputed-search-index)) that the worker loads and queries.

**Class-table CSVs are ephemeral**, like temporal coverage inputs. If the lookup is updated, the admin reprocesses with a new file.

---

## Storage schemas

### `OrganismInfo` (Postgres jsonb on `overlay_data_tables`)

GraphQL scalar + type guard in `@seasketch/geostats-types`, same attachment style as `TemporalInfo` (`@omit` the raw column; `updateOverlayDataTableOrganism` forces `authoredBy: "admin"`).

```ts
type OrganismColumnRole =
  | "code" // classcode, Species_Code — the observation filter value, if different from the identity column
  | "scientificName" // binomial in one column
  | "genus"
  | "species" // specific epithet
  | "commonName"
  | "wormsAphiaId"
  | "description"; // protocol notes, size cut-offs, species_definition, …

type OrganismInfo = {
  version: 1;
  /** Observation parquet column used as q.{column} (classcode, Common_Name, scientificname). */
  column: string;
  /**
   * How values in `column` look. Informs heuristics and labels only.
   * Filter values are always the raw strings in `column`.
   */
  valueKind: "code" | "scientificName" | "commonName" | "mixed";
  /**
   * Roles assigned during the last enrichment run.
   * Keys are class-table column names when a CSV was used, or observation
   * column names when enriching from the table itself.
   */
  roles: { [columnName: string]: OrganismColumnRole | OrganismColumnRole[] };
  authoredBy?: "ingest" | "admin" | "heuristic";
  /**
   * When true, low-confidence common-name iNaturalist matches are treated as
   * classified and their taxon ids go on the search index. Preview always
   * shows the guess and its confidence. Default false.
   */
  includeLowConfidenceMatches?: boolean;
  /** Distinct values in `column` at last enrichment. */
  valueCount?: number;
  /** Classified values at last enrichment (honors includeLowConfidenceMatches). */
  classifiedCount?: number;
};
```

Description text is always stored and searchable. The client decides how much to show (progressive reveal — a one-line teaser, expand on demand). There is no admin flag for this.

`valueCount` / `classifiedCount` are shown in the admin UI so a copied catalog after a CSV replace is easier to notice (a jump in unclassified codes). Observation-file replace still **copies** organism sidecars.

Heuristics (column name contains `classcode`, `scientific`, `common`, `genus`, `aphia`, `definition`, `description`, …) may **pre-fill** `roles`. The admin must confirm. Do not silently guess.

### Catalog sidecar (R2, next to the table)

Path convention, sibling of today’s files:

```text
projects/{slug}/public/{uuid}/dataTables/{uploadId}/data.parquet
projects/{slug}/public/{uuid}/dataTables/{uploadId}/column-stats.json
projects/{slug}/public/{uuid}/dataTables/{uploadId}/organism-catalog.parquet
projects/{slug}/public/{uuid}/dataTables/{uploadId}/organism-search.json
```

One row per **distinct** value of `OrganismInfo.column` (complete set — not the 500-value `column-stats.json` histogram). Conceptual columns:

| Field                | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `value`              | Exact observation-column string. This is what `/query` filters on.                                  |
| `scientific_name`    | Accepted / display binomial if known                                                                |
| `common_name`        | Best common name (class table, then iNat preferred)                                                 |
| `common_names`       | Extra vernaculars (class table + WoRMS + iNat), searchable                                          |
| `genus`, `family`, … | From class table and/or WoRMS / iNat ancestors                                                      |
| `ancestor_names`     | Flattened “Rockfishes Sebastes Scorpaenidae Labridae Wrasses …” for local hierarchical search       |
| `description`        | Concatenation of columns mapped to `description`                                                    |
| `inat_taxon_id`      | Integer or null                                                                                     |
| `worms_aphia_id`     | Integer or null                                                                                     |
| `search_text`        | Denormalized blob: value + all names + ancestors + description + extras (`Rockfish` flag, category) |
| `occurrence_count`   | Optional; cheap if computed during enrichment                                                       |
| `confidence`         | `high` / `low` / `unresolved`. Always shown in the admin preview.                                   |

**Do not store thumbnail URLs.** Store ids only.

Unresolved values (no API hit) still get a row. `search_text` is at least the raw `value` plus any class-table names. Low-confidence iNaturalist guesses stay on the preview row (id + confidence) even when `includeLowConfidenceMatches` is false; the switch only controls whether that id is **used** (search index + classified count).

### API response cache (enrichment only)

Do **not** persist taxonomy responses on R2. The enrichment handler calls an allowlisted proxy on `pmtiles-server`:

```text
GET  /taxonomy/inat/v1/taxa/{id},{id}
GET  /taxonomy/worms/AphiaRecordByAphiaID/{id}
POST /taxonomy/worms/AphiaRecordsByMatchNames
```

Wikidata SPARQL (`https://query.wikidata.org/sparql`) is called **directly** from the handler — not through this proxy — so it does not share iNat’s rate limit.

`TaxonomyBackend` caches with the Workers **Cache API** for **one hour**. This is not an open proxy (path allowlist only). The uncached gateway requires the same **overlay-engine** JWT overlay-worker already uses (`Authorization: Bearer`); map-access tokens are rejected. A 700-value run is a handful of Wikidata POSTs plus ~24 iNat id batches. Running timeout stays 15 minutes (Lambda cap).

---

## Enrichment

Temporal-style reprocess. Does not rewrite `data.parquet`.

1. Admin picks `OrganismInfo.column`. Suggest likely names; require confirmation.
2. Optionally upload a class-table CSV for this run. Admin assigns `roles` (code, scientific, genus, species, common, WoRMS id, **description**). Multiple columns may be `description` or `commonName`.
3. Distinct values of `column` are listed. If a class table is present, left-join on the `code` role (or on the identity column if the class table uses the same strings as the observation column — CCFRP `Common_Name`).
4. Resolve each value (see below). Preview **every** row: names, ancestors, description, whether ids resolved. Fetch preview thumbnails the same way the client will (by iNat id, visible page only).
5. v1: **no per-value override UI.** Walking the CA datasets will show what editing is actually needed.
6. Write/replace the catalog sidecar, the search index, and `OrganismInfo`.

Works with or without a class table.

### Resolution order (per distinct value)

1. If a `wormsAphiaId` role is populated → `AphiaRecordByAphiaID` (cached). Use `valid_name` if the record is unaccepted.
2. Else if a scientific name or genus+species can be built → WoRMS `AphiaRecordsByMatchNames` in batches of ≤50.
3. Wikidata SPARQL (≤50 per request): AphiaID via P850, then scientific / common names via P225, English `rdfs:label`, and P1843 → P3151 iNat taxon id. AphiaID or scientific-name hits are **high** confidence. A common-name-only hit is **low** confidence. Ambiguous names (two different iNat ids) are dropped.
4. `GET /v1/taxa/{ids}` (≤30) for ancestors + preferred common name. If `is_active` is false, follow `current_synonymous_taxon_ids` and fetch those ids too. Never call iNat `?q=` during enrichment.
5. Lumps (`Laminaria spp.`, `Sebastes spp.`, `PHYSPP`) → resolve to genus when possible. Ancestor search still works.
6. No scientific or common signal (`boulder`, `SAND`, some UPC categories) → no API calls. Catalog from class-table labels + description only.

Queue + backoff. **Batch** WoRMS `AphiaRecordsByMatchNames` (≤50), Wikidata SPARQL (≤50), and iNat `GET /v1/taxa/{ids}` (≤30). De-duplicate names and AphiaIDs within a run. Do not fire parallel request storms. Do not assume the Worker cache.

Copy WoRMS/iNat **names and ancestor names** into the sidecar. That is what makes “rockfish” and “sheephead” work without a live API. Do not copy photo URLs.

---

## Precomputed search index

Enrichment is occasional; `orgQuery` is search-as-you-type, including across ~20 tables. Do not linear-scan catalog rows in the Worker.

**Why not scan the catalog.** Row count is modest (hundreds to low thousands per table). The catalog is still the wrong structure to load on every keystroke: it is assumed large (descriptions, ancestry, extras), and overlay search would pull **20** of them. Workers Paid CPU is plenty (default 30s); the real costs are R2/parse and the **6 simultaneous outgoing connections** limit. Twenty fat parquet reads, six at a time, will dominate latency. A compact index per table is smaller, cheaper to parse, and ranked.

**What to precompute.** At the end of enrichment, build an inverted index from the catalog and write it next to the table (`organism-search.json`). The catalog stays the source of truth; the index is derived and discarded/replaced on reprocess. Do not put organism documents in Postgres or D1. Do not build one project-wide index — ACL is per parent layer UUID, so indexes stay per table and `orgQuery` only opens tables the token can read.

**Library.** Use [MiniSearch](https://lucaong.github.io/minisearch/). It is in-memory, zero runtime deps, supports **prefix** (typeahead), optional **fuzzy**, **field boosting**, and `JSON.stringify` / `MiniSearch.loadJSON` with the same options. That pattern is already used on Cloudflare Workers for docs search. FlexSearch export/import is weaker for document indexes. A first-party token→postings map is fine if we want zero extra dependency, but we would reimplement prefix match and BM25-ish ranking; start with MiniSearch.

Index these fields (separate, so boosts apply):

| Field | Boost | Why |
| --- | --- | --- |
| `value` | 8 | Exact classcode / `Common_Name` / raw identity (`SPUL`, `boulder`) |
| `common_name` | 6 | “Sheephead”, “Bocaccio” — what people type |
| `scientific_name` | 5 | `Bodianus pulcher`, including accepted-name synonyms copied at enrich |
| `common_names` | 3 | Extra vernaculars |
| `genus` | 3 | `Sebastes`, `Laminaria` |
| `ancestor_names` | 2 | “Rockfishes”, family names — hierarchical recall, lower than a real species hit |
| `description` | 1 | Protocol notes / `species_definition` — useful but noisy |

Search defaults: `prefix: true` so `shee` hits Sheephead. Keep fuzzy off at first (or only for queries longer than ~5 characters at `0.2`); fuzzy on short strings will flood false positives. Combine AND across query tokens. Do not stem; downcase; keep codes as single tokens.

`storeFields` on the index should be enough to **render a hit** (`value`, names, ids, description, `column`) so `orgQuery` does not also open the catalog. That is the point of the extra file.

**Worker query path**

1. Resolve each table prefix → `organism-search.json`.
2. Fetch indexes in batches of ≤6 (connection cap). Cache the **deserialized** MiniSearch instance in the isolate, keyed by prefix + ETag, same idea as today’s parquet-footer cache (`DataTablesBackend` metadata map). Repeat keystrokes on a warm isolate should not re-parse JSON.
3. `search(q, { prefix: true, boost: { … } })` per table. Merge, keep table prefix + score, sort by score, `limit`.
4. Overlay search and the selector use the same boosts. A hit on `common_name` outranks a hit that only matched `ancestor_names` (“rockfish” → every *Sebastes* still appears, below “Rockfish” the genus/lump if present).

**Size.** A MiniSearch JSON for ~700 organisms with stored display fields is on the order of hundreds of KB, not megabytes. Twenty of those is the overlay-search budget. If a table ever exceeds that, the format can change without changing `orgQuery`.

---

## `orgQuery` — the only organism search API

There is no per-table search route. Every consumer uses:

```text
GET /orgQuery?tables={ref},{ref},…&q=sheephead
```

- **Organism Selector:** one table ref.
- **Overlay search (CA project):** every enriched table — on the order of **20**.

Table refs must identify the sidecar under possibly **different parent layer UUIDs** (KFM sites vs CCFRP grid cells vs estuary stations). The client already has each table’s `queryUrl` / parquet prefix from GraphQL. Pass those prefixes (or `parentUuid/uploadId` pairs the worker can turn into prefixes). Do not invent a Postgres lookup of upload ids.

ACL is the same as `/query`: each prefix classifies as `published` for its parent `{uuid}`; strip `access_token` before the backend; skip tables the token cannot read.

The worker loads each table’s **search index** (not the catalog), runs the query with prefix matching and field boosts, merges hits, and returns the stored display fields:

```json
{
  "q": "sheephead",
  "tablesScanned": 20,
  "hits": [
    {
      "table": "projects/ca/public/{kfmUuid}/dataTables/{uploadId}",
      "tocStableId": "…",
      "tableStableId": "…",
      "tableName": "Fish transects",
      "column": "classcode",
      "value": "SPUL",
      "scientificName": "Bodianus pulcher",
      "commonName": "California Sheephead",
      "description": null,
      "inatTaxonId": 1439813,
      "wormsAphiaId": 1702292
    }
  ]
}
```

`tocStableId` / `tableStableId` / `tableName` can come from the request (client already has them). The engine only needs the index’s stored fields plus the table prefix.

Selecting one hit → existing `q.{column}={value}`. Selecting a higher-taxon result set (all hits in this table whose `ancestor_names` matched “rockfish”) → `q.{column}=in.(…)`.

Map aggregations are unchanged (`packages/client/src/dataLayers/dataTableQueryApi.ts`).

Overlay **title** search stays `search_overlays` FTS. Organism hits are **merged in the client** from `orgQuery`. Do not stuff species names into TOC `tsvector`s.

---

## Runtime photos

Allowed, with a tight budget.

1. `orgQuery` returns. The UI has a visible slice (on the order of 10–20 rows), not 20 tables × 700 values.
2. Collect unique `inatTaxonId`s in that slice that are not already in the session memo.
3. `GET https://api.inaturalist.org/v1/taxa/{id,id,…}` (≤30 ids). Memoize by id for the session (memory; optional `sessionStorage`).
4. If `default_photo.license_code` is missing, skip the image. Otherwise show `square_url` and `attribution`.
5. **Never** fetch on each keystroke before results return. **Do not** prefetch photos for every overlay-search hit across 20 tables. Overlay search can omit thumbs; the selector shows them for the visible page after results.

A single user opening the KFM selector and scrolling slowly stays well under 10k/day. A client that requested 20 ids per keystroke across a project would not.

Admin preview uses the same helper.

---

## How data reaches the UI

### Admin

Column picker → optional class CSV → role mapping (heuristics as defaults) → preview of every value → commit catalog, search index, and `OrganismInfo`. Same job family as temporal / nodata reprocess (`create_overlay_data_table_reprocess` or a sibling).

When `OrganismInfo` is present, `DataTableFilterControls` routes that column to the Organism Selector instead of `DataTableStringFilter`. Other filters are unchanged. Admin `required_filter_columns` / `filter_column_labels` still apply (label might be “Species” instead of `classcode`).

### Organism Selector

`orgQuery?tables={thisPrefix}&q=`. Results show common name and scientific name. Description text, when present, is a progressive reveal in the client (teaser / expand), not an admin setting. Thumbnails for the visible page via iNat ids. Multi-select and “all rockfish in this table” expand to `in.(…)`. Substrate values appear like any other value.

### Overlay search (later)

Existing `useOverlaySearchState` + `search_overlays` for layer titles. In parallel, `orgQuery?tables={all enriched prefixes}&q=`. Organism hits render as choices (“California Sheephead — Kelp Forest / Fish Transects”). On choose: toggle the TOC item, activate that Data Table, set the organism filter. The user does not need to know the monitoring folder exists.

---

## Use-case support

| Dataset                                   | Identity column            | Class table                                             | Enrichment                             | Selector                   | Overlay `orgQuery` |
| ----------------------------------------- | -------------------------- | ------------------------------------------------------- | -------------------------------------- | -------------------------- | ------------------ |
| KFM Fish / Swath / Size                   | `classcode`                | taxon_table (names + notes)                             | Join on code; WoRMS/iNat from binomial | Yes; all codes             | Yes                |
| KFM UPC                                   | `classcode`                | same; includes substrate                                | Same; no API for `boulder`             | Yes, including `boulder`   | Yes                |
| CCFRP Effort / Length                     | `Common_Name`              | optional species_table (AphiaID + `species_definition`) | Works with or without CSV              | Yes                        | Yes                |
| EMPA BRUVs / seines / crabs / algae / veg | `scientificname` (typical) | usually none                                            | Single-column                          | Yes                        | Yes                |
| EMPA trash / feldspar / sediment          | —                          | —                                                       | Skip                                   | Generic filters            | No                 |
| MARINe intertidal                         | names / lumps              | cbs_species_table (WoRMS id)                            | Prefer AphiaID                         | Yes; cover classes visible | Yes                |
| Mid-depth fish                            | species name               | optional ROV lookup                                     | Same pattern                           | Yes                        | Yes                |
| Sandy beach fish / birds                  | species name               | if present                                              | Same                                   | Yes                        | Yes                |
| Sandy beach people / physical             | —                          | —                                                       | Skip                                   | Generic                    | No                 |
| RCCA / HAB / others (later)               | codes or names             | often yes                                               | Same; HAB photos sparse                | Yes                        | Yes                |

A California project overlay search may pass ~20 enriched table prefixes in one `orgQuery`.

---

## Implementation phases

Sequential. Each phase is a functional boundary. Later phases must not be started until the previous one is demoable in the environment it needs (local is enough until a service deploy is called out).

Shared lock-in from phase 2 onward: MiniSearch **version + `fields` / `storeFields` / tokenize options** must be identical in `data-tables-handler` (writer) and `pmtiles-server` (reader). Put that contract in one small shared module both packages import. Changing boosts or tokenization requires re-enrichment.

`/query` and map aggregations stay untouched until phase 5, and then only as callers of the existing filter API (`q.{column}=` / `in.(…)`).

### Phase 1 — Types, column, GraphQL field

**What.** `OrganismInfo` + `isOrganismInfo` next to `TemporalInfo` in `@seasketch/geostats-types`. Migration: `overlay_data_tables.organism jsonb`, `@omit` the raw column, computed GraphQL `organism`, `updateOverlayDataTableOrganism` (forces `authoredBy: "admin"`). Copy the column through `publish_table_of_contents` and `copy_table_of_contents_item` (hard-coded lists). Changelog field group if temporal/nodata have one. Client fragments read `organism` but **do not branch UI on it**.

**Deploy.** **API** (migration + plugin). No handler or worker change.

**Done when.** GraphQL returns `organism: null` on existing tables; setting a stub document round-trips; publish/duplicate copies it.

### Phase 2 — Enrichment engine (`data-tables-handler`)

**What.** New job family (prefer a sibling of `create_overlay_data_table_reprocess`, e.g. `create_overlay_data_table_organism_reprocess`, so temporal/nodata jobs stay unchanged). Does not rewrite `data.parquet`.

- Distinct values of the identity column from the current parquet (complete set, not the 500-value histogram).
- Optional ephemeral class CSV (presigned upload, discarded after the job).
- Role heuristics as defaults only.
- WoRMS → Wikidata (P850/P225 → P3151) → iNat id batches. No `preferred_place_id`. No iNat `?q=`. Taxonomy HTTP for iNat/WoRMS goes through `/taxonomy` on `pmtiles-server` (1 hour Cache API). Wikidata SPARQL is direct from the handler.
- `includeLowConfidenceMatches` on the job config. Preview always includes confidence.
- Write `organism-catalog.parquet` and `organism-search.json` next to the table.
- Persist `OrganismInfo` on success (`complete_overlay_data_table_upload` or a dedicated complete).
- Job result includes a **full preview payload** (or a small preview JSON beside the catalog): every value, names, ancestors, description, ids, confidence. Admin UI will render this; it must not depend on `orgQuery`.

**Deploy order.**

1. **`pmtiles-server`** — `/taxonomy` proxy (1 hour Cache API). Deploy this before production enrichment that sets `TAXONOMY_PROXY_URL`.
2. **`data-tables-handler`** — production Lambda/service that understands the new job. Deploy this **before** the API starts enqueueing those jobs.
3. **API** — mutation + complete path that writes `organism`.

**Done when.** A scripted or GraphQL-triggered job on a CA table (KFM Fish with taxon CSV, or EMPA `scientificname` with no CSV) writes catalog + index + `OrganismInfo`. Re-run replaces sidecars. Failed API lookups still produce catalog rows.

### Phase 3 — Admin enrichment UI  ← **demo stop**

**What.** Client-only wizard on the Data Tables editor (same neighborhood as `DataTableTemporalEditor` / nodata): pick identity column → optional class CSV → confirm roles → run the phase-2 job → show **every** preview row (names, ancestors, description, resolved/unresolved). Visible-page iNat thumbs via taxon id (same helper the map will use later). Local text filter over the preview list is fine for the demo; do not call `orgQuery`. v1: no per-value overrides.

Map, legend filters, and overlay search are **unchanged**. `DataTableFilterControls` still uses `DataTableStringFilter` even when `organism` is set.

**Deploy.** Client (and API only if the mutation shipped in phase 2). **Do not redeploy `pmtiles-server`.**

**Done when.** An admin can enrich a real CA table, inspect the full catalog in the wizard (including `boulder` / lumps / unresolved), and see `OrganismInfo` on the table — and a published map still filters that column with the generic string control. **Stop here and demo. Do not start map filtering.**

---

### Phase 4 — `orgQuery` (`pmtiles-server`)

**What.** `GET …/orgQuery?tables={ref},…&q=` on `DataTablesBackend` (or sibling). Load `organism-search.json` only; isolate cache by prefix + ETag; ≤6 concurrent R2 fetches; same ACL as `/query`. GraphQL `orgQueryUrl` (and admin-only catalog URL if useful). No selector UI yet — curl / a scratch page is enough.

**Deploy order.**

1. **`pmtiles-server`** (Cloudflare Worker). Until this ships, `orgQueryUrl` 404s.
2. **API** — expose `orgQueryUrl` only after the worker route exists (or ship them together).

**Done when.** One-table and many-table queries return ranked hits with stored display fields. Warm-isolate repeat queries do not re-parse JSON.

### Phase 5 — Organism Selector on the map

**What.** Client: if `OrganismInfo` is present, route that column through the Organism Selector instead of `DataTableStringFilter`. One-table `orgQuery`. Multi-select and ancestor expansion → existing `q.{column}=` / `in.(…)`. Progressive description reveal. Thumbs for the visible page only. Required/hidden filter settings still apply.

**Deploy.** Client only. `/query` unchanged.

**Done when.** Viewing a map with an enriched table, the user can search “sheephead” / “rockfish” / `SPUL` / `boulder` and the bubble map updates. Overlay listing search still ignores organisms.

### Phase 6 — Overlay layers listing search

**What.** Last. `useOverlaySearchState` keeps `search_overlays` for titles. In parallel, `orgQuery?tables={all enriched prefixes}&q=`. Merge hits in the client. Choosing a hit: turn on the TOC item, activate that Data Table, apply the organism filter. Do not write species names into Postgres FTS. Overlay search can omit thumbs.

**Deploy.** Client only (worker already serves multi-table `orgQuery` from phase 4).

**Done when.** A project-root overlay search for “Sheephead” lists the matching monitoring tables and activates the right layer + filter without the user opening the folder tree.

---

## Open questions (walk the CA datasets in v1)

- Which class-table columns should default to `description` on KFM vs CCFRP vs MARINe.
- Whether overlay search should show thumbs at all (quota vs delight).
- Later: report widgets grouping KFM `SPUL` and CCFRP “California Sheephead” on `inat_taxon_id`.
- Later: per-value admin overrides, once the previews show where auto-resolve fails.
