---
name: Report Overlay Source Slim Refactor
overview: Refactor all report widget usages of `source.geostats` and `source.mapboxGlStyles` (via the `OverlaySourceDetails` fragment) to use the new slim fields now live in the schema and fragment.
todos:
  - id: migrate-ClassTableRows
    content: "Migrate ClassTableRows.ts: replace isRasterSource (use geometryType), swatch generation for non-grouped and raster rows, and grouped row category values with columnSummaries"
    status: pending
  - id: migrate-widgets-command-palette
    content: "Migrate widgets.tsx: replace raster/vector detection, geometry-specific commands, column defaults (recommendedGroupBy, bestLabelColumn via columnSummaries, numeric columns)"
    status: pending
  - id: migrate-ClassRowSettingsPopover
    content: "Migrate ClassRowSettingsPopover.tsx: replace groupBy options and rowLinkedStableIds auto-population using columnSummaries and highCardinality"
    status: pending
  - id: migrate-column-pickers
    content: Migrate IntersectingFeaturesList, InlineMetric, ColumnStatisticsTable, ColumnValuesHistogram admin tooltips to use columnSummaries (ColumnType enum values)
    status: pending
  - id: migrate-source-dropdowns
    content: "Migrate ReportSourceLayerDropdown and ReportLayerMultiPicker: replace getGeometryTypeFromGeostats with source.geometryType for processed sources"
    status: pending
  - id: defer-histogram-widgets
    content: Add graceful degradation to RasterValuesHistogram (bins gap) and ColumnValuesHistogram color coding (use columnSummaries.colors instead of GL expression)
    status: pending
isProject: false
---

# Report Overlay Source Slim Refactor

## Schema Changes Already Made

The following fields are now live in `ReportOverlaySource` and in the `OverlaySourceDetails` fragment. Codegen has been run.

**New on `ReportOverlaySource`:**
- `geometryType: String!` — `"Raster"` for rasters, or a GeoJSON geometry string (`"Polygon"`, `"MultiPolygon"`, `"Point"`, `"MultiPoint"`, `"LineString"`, `"MultiLineString"`) for vectors. This replaces all `isRaster` checks and `geostatsLayer.geometry` references. **Note**: `isRaster: Boolean!` is still in the SDL but is NOT in the fragment — always use `geometryType`.
- `recommendedGroupBy: String` — the attribute name driving the layer's data-driven map paint expression, computed server-side. Replaces `groupByForStyle(mapboxGlStyles, geostatsLayer)`.

**New on `ColumnSummary`:**
- `highCardinality: Boolean!` — when `false`, the server guarantees `sampleValues` contains **all** distinct values (not just a sample). This is the key to replacing `Object.keys(attr.values)` from geostats.
- `type: String!` — plain string values `"string"`, `"number"`, `"boolean"` (lowercase, no enum). Comparisons use string literals directly.
- `multiColorSwatchLayout: String` — plain string values `"raster-ramp-order"` or `"soft-scatter"` (kebab-case, no enum).

---

## Part 1: Where geostats and mapboxGlStyles Are Used

Every report widget that accepts `sources: OverlaySourceDetailsFragment[]` currently reads from the now-absent `geostats` and `mapboxGlStyles` fields. Here's the breakdown by widget:

### `ClassTableRows.ts`

- `isRasterSource()` — checks `"bands" in source.geostats` → replace with `source.geometryType === "Raster"`
- `getRasterColorsFromStyle(source.mapboxGlStyles)` — extracts raster-color paint stops → replace with `columnSummaries`
- `vectorSwatchFromSource(source, ...)` — reads `source.mapboxGlStyles` for palette colors → replace with `columnSummaries`
- `extractColorsForCategories(values, attr, source.mapboxGlStyles)` — maps each groupBy category value → color → replace using aligned `sampleValues[i]`/`colors[i]` (see Gap 1)
- `source.geostats.layers[0].attributes[groupBy].values` — enumerates distinct category values for grouped rows → replace with `sampleValues` when `!highCardinality`

### `widgets.tsx` (command palette / slash commands)

- `"bands" in source.geostats && ...bands.length === 1/> 1` → `source.geometryType === "Raster" && source.bandCount === 1/> 1`
- `"layers" in source.geostats` (vector detection) → `source.geometryType !== "Raster"`
- `geostatsLayer.geometry` (Polygon/Point/LineString) for geometry-specific widget suggestions → `source.geometryType`
- `geostatsLayer.attributes` for numeric / label column discovery → `source.columnSummaries`
- `groupByForStyle(source.mapboxGlStyles, geostatsLayer)` → `source.recommendedGroupBy`
- `labelColumnForGeostatsLayer(geostatsLayer, source.mapboxGlStyles)` → simplified heuristic over `columnSummaries`

### `ClassRowSettingsPopover.tsx`

- `source.geostats.layers[0].attributes` → groupBy dropdown options → `columnSummaries` (use `ColumnType` enum)
- `source.geostats.layers[0].attributes[groupBy].values` → all distinct values for `rowLinkedStableIds` → `sampleValues` when `!highCardinality`

### `IntersectingFeaturesList.tsx` (admin tooltip)

- `source.geostats.layers[0].attributes` → label column picker and hidden-column management → `columnSummaries`

### `InlineMetric.tsx` (admin tooltip)

- `source.geostats.layers[0].attributes` → column picker for `column_values` presentation → `columnSummaries`

### `ColumnStatisticsTable.tsx` (admin tooltip)

- `source.geostats.layers[0].attributes` (numeric only) → column picker → `columnSummaries` filtered by `cs.type === "number"`

### `ColumnValuesHistogram.tsx`

- `source.geostats.layers[0].attributes` → numeric column picker → `columnSummaries`
- `source.mapboxGlStyles` → color-codes histogram bars → `columnSummaries[i].colors` (see Gap 2)

### `RasterValuesHistogram.tsx`

- `source.geostats` as `RasterInfo` → `rasterInfo.bands[0].stats.histogram` bin boundaries for chart axis → **Gap 3 (unresolved)**
- `source.mapboxGlStyles` → `raster-color` paint expression for color-coding → `columnSummaries[0].colors`

### `ReportSourceLayerDropdown.tsx` / `ReportLayerMultiPicker.tsx`

- `getGeometryTypeFromGeostats(source.geostats)` on **processed sources** (from `reportingLayers` which uses `...OverlaySourceDetails`) → replace with `source.geometryType`
- **Draft TOC items** still use `ds?.geostats` from `DataSource` directly — this is a separate query path, not from `OverlaySourceDetails`, and is out of scope for this refactor

---

## Part 2: Migration Code Patterns

### Raster / vector detection

```typescript
// Before
if ("bands" in source.geostats && source.geostats.bands.length === 1)
if ("bands" in source.geostats && source.geostats.bands.length > 1)
if ("layers" in source.geostats && isGeostatsLayer(source.geostats.layers[0]))

// After
if (source.geometryType === "Raster" && source.bandCount === 1)
if (source.geometryType === "Raster" && (source.bandCount ?? 0) > 1)
if (source.geometryType !== "Raster")
```

### Overall swatch (non-grouped rows)

Replace `getRasterColorsFromStyle(mapboxGlStyles)` and `vectorSwatchFromSource(source, extractColorForLayers(styles))` with the pre-computed colors from `columnSummaries`. The first summary with `colors` populated is the styling column:

```typescript
function swatchFromColumnSummaries(source: OverlaySourceDetailsFragment) {
  const cs = source.columnSummaries?.find((c) => c.colors?.length);
  if (!cs?.colors?.length) return {};
  if (cs.colors.length === 1) return { color: cs.colors[0] };
  // multiColorSwatchLayout is a plain string: "raster-ramp-order" | "soft-scatter"
  return {
    colors: cs.colors,
    multiColorSwatchLayout: (cs.multiColorSwatchLayout ?? undefined) as
      | "raster-ramp-order"
      | "soft-scatter"
      | undefined,
  };
}
```

### Column picker dropdowns

`type` is a plain `String` with values `"string"`, `"number"`, `"boolean"` (lowercase). No enum import needed:

```typescript
// Before
for (const attr of geoLayer.attributes) {
  if (attr.type !== "number") continue;
  const examples = Object.keys(attr.values || {}).slice(0, 5);
}

// After
for (const cs of source.columnSummaries ?? []) {
  if (cs.type !== "number") continue;
  const examples = (cs.sampleValues ?? []).slice(0, 5).map(String);
}
```

### groupBy column options (`ClassRowSettingsPopover.tsx`)

```typescript
// Before
const geoLayer = (source.geostats as any)?.layers?.[0];
// isString || isNumericWithFewValues check

// After
for (const cs of source.columnSummaries ?? []) {
  const eligible =
    cs.type === "string" ||
    (cs.type === "number" && !cs.highCardinality && cs.distinctValueCount <= 10);
  if (!eligible) continue;
  // cs.sampleValues for example values
}
```

### Grouped row category values

When `!cs.highCardinality`, `sampleValues` contains all distinct values. The aligned `colors[i]` ↔ `sampleValues[i]` contract means each category's color can be recovered:

```typescript
const cs = source.columnSummaries?.find(c => c.attribute === groupBy);
if (!cs || cs.highCardinality) {
  // Fall back to placeholder rows — can't enumerate values
} else {
  const values = cs.sampleValues as string[];
  const colorMap: Record<string, string> = {};
  cs.colors?.forEach((color, i) => {
    if (values[i] != null) colorMap[String(values[i])] = color;
  });
}
```

### `recommendedGroupBy` for command palette defaults

```typescript
// Before
const groupByColumn = groupByForStyle(source.mapboxGlStyles, geostatsLayer);

// After
const groupByColumn = source.recommendedGroupBy ?? undefined;
```

### `labelColumnForGeostatsLayer` replacement

The function currently scores attributes using both geostats metadata and style paint properties. With `columnSummaries`, simplify by:
- Picking the `STRING` column with lowest `distinctValueCount` that is not obviously an ID (filter with the existing name patterns)
- Falling back to first `STRING` column
- The style-attribute boost is dropped (no `mapboxGlStyles`), but `recommendedGroupBy` may be a good proxy for the label column too

### `ReportSourceLayerDropdown.tsx` — processed sources

```typescript
// Before
const gt = getGeometryTypeFromGeostats(layer.geostats);

// After
const gt = layer.geometryType as ReportSourceGeometryType | null;
// Map "Raster" → "SingleBandRaster" as needed by the existing ReportSourceGeometryType union
```

---

## Part 3: Remaining Gaps

### Gap 1 — Per-category color mapping contract (medium risk)

**Used by**: `ClassTableRows.ts` `extractColorsForCategories` for per-row colors in grouped tables.

**Current status**: The `colors[i]` ↔ `sampleValues[i]` alignment works *if* the server populates them in matching order. This needs to be an explicit server-side guarantee. If the ordering is not reliable, add a `categoryColors: [CategoryColor!]` field:

```graphql
type CategoryColor { value: String!; color: String! }
# add to ColumnSummary: categoryColors: [CategoryColor!]
```

Until confirmed, the client code can use the aligned-array approach with a fallback to a single-color swatch.

### Gap 2 — `ColumnValuesHistogram` color coding (low risk)

**Used by**: `ColumnValuesHistogram.tsx` uses `ExpressionEvaluator` on the raw `raster-color` GL expression to color histogram bars.

**Resolution**: Replace `getRasterColorExpression(mapboxGlStyles)` + `ExpressionEvaluator` with a simpler lookup using `columnSummaries.colors`. The bucket index maps directly to `colors[i]`. The `ExpressionEvaluator` can be removed for this widget.

### Gap 3 — `RasterValuesHistogram` bin definitions (high impact, unresolved)

**Used by**: `RasterValuesHistogram.tsx` reads `rasterInfo.bands[0].stats.histogram` for bin boundaries — these define the chart x-axis domain and bucket widths. Without them, the histogram cannot render.

**Options**:
- Add `rasterBins: [Float!]` to `ReportOverlaySource` (server computes from `RasterInfo.bands[0].stats.histogram.map(b => b[0])`)
- Add a richer `rasterStats` subtype for the full band stats
- Keep `RasterValuesHistogram` fetching `geostats` via a separate opt-in query, and leave it out of the `OverlaySourceDetails` slim path for now

Until resolved, add a graceful fallback: if bin data is absent, render the histogram using only metric-returned histogram data (relative bar heights without absolute domain labels).

---

## Files to Change

- [`packages/client/src/reports/widgets/ClassTableRows.ts`](packages/client/src/reports/widgets/ClassTableRows.ts) — migrate `isRasterSource`, swatch generation, grouped row values
- [`packages/client/src/reports/widgets/widgets.tsx`](packages/client/src/reports/widgets/widgets.tsx) — migrate raster/vector detection, geometry commands, `recommendedGroupBy`, column defaults
- [`packages/client/src/reports/widgets/ClassRowSettingsPopover.tsx`](packages/client/src/reports/widgets/ClassRowSettingsPopover.tsx) — migrate groupBy options and `rowLinkedStableIds` using `highCardinality`
- [`packages/client/src/reports/widgets/IntersectingFeaturesList.tsx`](packages/client/src/reports/widgets/IntersectingFeaturesList.tsx) — migrate label/column pickers
- [`packages/client/src/reports/widgets/InlineMetric.tsx`](packages/client/src/reports/widgets/InlineMetric.tsx) — migrate column picker
- [`packages/client/src/reports/widgets/ColumnStatisticsTable.tsx`](packages/client/src/reports/widgets/ColumnStatisticsTable.tsx) — migrate numeric column picker
- [`packages/client/src/reports/widgets/ColumnValuesHistogram.tsx`](packages/client/src/reports/widgets/ColumnValuesHistogram.tsx) — migrate column picker; replace `ExpressionEvaluator` color coding with `columnSummaries.colors`
- [`packages/client/src/reports/widgets/RasterValuesHistogram.tsx`](packages/client/src/reports/widgets/RasterValuesHistogram.tsx) — add graceful fallback; defer full fix until Gap 3 resolved
- [`packages/client/src/reports/widgets/ReportSourceLayerDropdown.tsx`](packages/client/src/reports/widgets/ReportSourceLayerDropdown.tsx) / `ReportLayerMultiPicker.tsx` — replace `getGeometryTypeFromGeostats` with `source.geometryType` for processed sources
