# SeaSketch RGB raster value encoding

SeaSketch hosts single-band continuous and categorical rasters as ordinary PNG
(or WebP) tiles inside PMTiles. Mapbox GL / MapLibre can only sample **byte**
channels from raster tiles, so scalar data values are packed into the R, G, and
B channels at upload time. At render time the map style unpacks those channels
back into a scalar `raster-value` used for coloring. The same packed tiles are
sampled for client-side interactivity (tooltips, banners, popups).

True multi-band RGB imagery is **not** packed; it is tiled and displayed as an
image.

---

## When encoding runs

Encoding is decided in `rasterInfoForBands.ts` (geostats / presentation) and
applied in `processRasterUpload.ts` via `encodeValuesToRGB`.

| `SuggestedRasterPresentation` | Encoded? | Typical input                                  |
| ----------------------------- | -------- | ---------------------------------------------- |
| `rgb`                         | No       | Source has Red + Green + Blue bands            |
| `continuous`                  | Yes      | Single-band Gray (e.g. bathymetry, effort)     |
| `categorical`                 | Yes      | Palette / few unique values (often byte-sized) |

Only `continuous` and `categorical` call `encodeValuesToRGB`. Presentation
`rgb` skips packing and uses cubic overviews; encoded layers use **nearest**
resampling so RGB codes are not blended into garbage values.

`byteEncoding` is a separate flag on `RasterInfo`. When true, styles (and
interactivity) treat the packed tile as **blue-channel-only** values even
though the full RGB encoder still ran. It is set for Byte datatypes, small
integer ranges that fit in 0–255, and certain palette / low-cardinality paths.

---

## Encoding parameters: `base` and `interval`

Stored on `RasterBandInfo` (`@seasketch/geostats-types`) and used by both the
encoder and the client style builders.

### Capacity

RGB bytes give \(2^{24} = 16{,}777{,}216\) distinct codes. A bias of **+32768**
centers the code space so values below `base` (including negatives relative to
base) can be represented.

### How `base` is chosen

```text
base = (stats.min >= 0) ? 0 : stats.min
```

Non-negative data keep `base = 0`. Negative minima (e.g. SST anomaly-style
grids) use `base = min` so the packed range starts at the data minimum.

### How `interval` is chosen

Default: `interval = 1` (one code per integer unit of the data value).

When **not** byte-encoding, and the band is Gray / high-cardinality float /
huge range, `rasterInfoForBands` may stretch or compress:

| Condition           | Effect                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `range < 500`       | Stretch: multiply by powers of 10 until the range approaches \(2^{24}\). Then `interval = 1 / scale` (e.g. `0.01`). Improves precision for small float ranges (e.g. 0–1). |
| `500 ≤ range ≤ 2²⁴` | Leave `interval = 1`.                                                                                                                                                     |
| `range > 2²⁴`       | Compress: divide scale by powers of 10 until the range fits; `interval = 1 / scale` (> 1). Loses precision.                                                               |

Here `range = stats.max - base`. The local variable named `scale` in
`rasterInfoForBands` is **not** the GDAL band scale metadata (see below).

### Quantization (important)

Packing uses **floor**:

\[
N = \left\lfloor \frac{A - \text{base}}{\text{interval}} \right\rfloor + 32768
\]

With `interval = 1`, fractional parts of \(A\) are discarded. Example: a
geostats maximum of `611.478` encodes as `611`. Tooltips that decode tiles will
show `611`, while legends built from raw geostats min/max may still show
`611.478` unless the UI quantizes labels to match tile values.

---

## Packing algorithm (`encodeValuesToRGB`)

Implemented with `gdal_calc.py` into three Byte bands, then merged with
`gdalbuildvrt -separate` / `gdal_translate`.

Let \(A\) be the source pixel value.

\[
\begin{aligned}
N &= \left\lfloor (A - \text{base}) \cdot \frac{1}{\text{interval}} \right\rfloor + 32768 \\
R &= \left\lfloor N / 65536 \right\rfloor \\
G &= \left\lfloor (N \bmod 65536) / 256 \right\rfloor \\
B &= N \bmod 256
\end{aligned}
\]

### Nodata → alpha

If `noDataValue` is set:

\[
\alpha = 255 \cdot [A \neq \text{noDataValue}]
\]

Output is RGBA. Mapbox uses source alpha as opacity; alpha is **not** part of
`raster-color-mix`. Transparent pixels (`α = 0`) are treated as no-hit for
interactivity.

If there is no nodata, output is RGB only (opaque).

### Inverse (exact integer / byte math)

Used by client interactivity when sampling source tile bytes (not the GPU mix):

```text
N = R * 65536 + G * 256 + B
A = (N - 32768) * interval + base          # full 24-bit
A = B + base                               # byteEncoding (blue only)
```

See `packages/client/src/dataLayers/rasterValueEncoding.ts`.

---

## GDAL `scale` / `offset` vs encoding `base` / `interval`

| Field                                         | Meaning                                         |
| --------------------------------------------- | ----------------------------------------------- |
| `band.base`, `band.interval`                  | RGB packing parameters (this document)          |
| `band.scale`, `band.offset`                   | GDAL metadata (e.g. stored DN → physical units) |
| `data_sources.raster_scale` / `raster_offset` | Same GDAL values surfaced on the GraphQL source |

Encoding and Mapbox `raster-value` operate in the **packed / DN** domain.
Physical units for legends and `{{value}}` tooltips may apply
`value * scale + offset` when style metadata has
`s:respect-scale-and-offset` (set when GDAL scale/offset are present).

Do not confuse GDAL scale with the temporary stretch factor used while
computing `interval`.

---

## Tiling after encode

Encoded GeoTIFFs are converted to MBTiles (typically **512×512** blocks) then
`pmtiles convert`. Overviews for encoded data use nearest resampling. The
hosted source URL is the PMTiles path without `.pmtiles`; the client loads
TileJSON at `{url}.json` and ZXY image tiles from pmtiles-server.

---

## How the client uses this

### 1. Map styles (`raster-color-mix` → `raster-value` → `raster-color`)

Style builders (duplicated in a few places historically):

- `packages/gl-style-builder/lib/builders/rasters.ts`
- `packages/client/src/admin/data/styleEditor/visualizationTypes.ts`
- `packages/api/src/spatialUploads/index.ts` (initial style on upload)

Mapbox computes:

\[
\text{raster-value} = r \cdot m_0 + g \cdot m_1 + b \cdot m_2 + m_3
\]

with \(r,g,b\) in **\[0, 1\]** (texture normalized). Mapbox’s internal
color-mix factor is approximately \(1/258\), so styles use **258** (not 255)
as the byte-recovery multiplier
([mapbox-gl-js#13190](https://github.com/mapbox/mapbox-gl-js/issues/13190)).

**Full 24-bit continuous mix** (expressions may nest `*` / `+`):

```js
[
  ["*", 258, 65536], // R
  ["*", 258, 256], // G
  258, // B
  ["+", -32768, band.base], // offset
];
// if interval !== 1, every component is wrapped: ["*", interval, channel]
```

**Byte / categorical mix:**

```js
[0, 0, 258, band.base]; // blue only ≈ B + base
```

Then `raster-color` maps `["raster-value"]` through interpolate/step expressions
over `raster-color-range` (usually `[minimum, maximum]`, or `[min, min+255]`
for byte encoding).

Always `"raster-resampling": "nearest"` for encoded layers.

True RGB image styles omit `raster-color-mix` and paint the image as-is.

### 2. Interactivity (pixel under cursor)

Mapbox does **not** expose packed source values via `queryRenderedFeatures`, and
reading the WebGL canvas would return **styled** colors after `raster-color`,
not encoded RGB. SeaSketch therefore:

1. Fetches the same ZXY source tiles (authorized like the map).
2. Decodes the image to an in-memory RGBA buffer (small LRU cache for rapid
   same-tile brushes; browser HTTP cache handles network).
3. Indexes the pixel and runs `decodeRgbEncodedRasterValue` with params from
   **`raster-color-mix`** on the layer style (`encodingParamsFromRasterColorMix`),
   so admin and published maps share one decode path.
4. Optionally applies GDAL scale/offset when `s:respect-scale-and-offset` is set.
5. Renders Mustache templates with `{{value}}` (decoded number) and
   `{{label}}` (legend override from `metadata["s:legend-labels"]`, else the
   value string) for Banner / Tooltip / Popup.

Eligibility in the admin Interact UI is narrower (single-band Gray
`SEASKETCH_RASTER`); runtime sampling only requires a parsable mix +
interactivity ≠ None.

Key client modules:

- `packages/client/src/dataLayers/rasterValueEncoding.ts`
- `packages/client/src/dataLayers/rasterPixelQuery.ts`
- `packages/client/src/dataLayers/LayerInteractivityManager.ts`

### 3. Legends and reports

Legends compile from the GL style (`raster-color` stops / steps), which are
authored against geostats min/max and the same mix. Report widgets that need
band metadata read `RasterInfo` from source geostats (e.g. histograms).

---

## End-to-end flow

```text
Upload GeoTIFF
    │
    ├─ rasterInfoForBands → presentation, base, interval, byteEncoding, stats
    │
    ├─ [continuous|categorical] encodeValuesToRGB → RGB(A) GeoTIFF
    │  [rgb] skip encode
    │
    └─ createPMTiles → hosted {url}.json + ZXY tiles
           │
           ▼
Client map: raster source + mapboxGlStyles
           │
           ├─ GPU: raster-color-mix → raster-value → raster-color
           └─ Interact: fetch tile → RGBA sample → integer decode → {{value}}/{{label}}
```

---

## Worked example

Continuous Gray band, `min = 0.004`, `max = 611.478`, `base = 0`,
`interval = 1` (range ≥ 500, so no float stretch):

| Step                        | Result                                          |
| --------------------------- | ----------------------------------------------- |
| Value \(A = 611.478\)       | \(N = \lfloor 611.478 \rfloor + 32768 = 33379\) |
| RGB                         | \(R = 0\), \(G = 130\), \(B = 99\)              |
| Decode                      | \(N - 32768 = 611\)                             |
| Tooltip                     | `611`                                           |
| Geostats max / style domain | `611.478`                                       |

Blue-only byte path with `base = 0`, value 40 in range: packed such that
\(B = 40\) (because \(32768 \equiv 0 \pmod{256}\)); mix `[0,0,258,0]` recovers
≈ 40.

---

## Key source files

| Role                               | Path                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Stats, base/interval, presentation | `src/rasterInfoForBands.ts`                                             |
| RGB pack + PMTiles                 | `src/processRasterUpload.ts` (`encodeValuesToRGB`, `createPMTiles`)     |
| Types                              | `packages/geostats-types/lib/index.ts` (`RasterInfo`, `RasterBandInfo`) |
| Style mix builders                 | `packages/gl-style-builder/lib/builders/rasters.ts`                     |
| Client decode / mix parse          | `packages/client/src/dataLayers/rasterValueEncoding.ts`                 |
| Client tile sample                 | `packages/client/src/dataLayers/rasterPixelQuery.ts`                    |
| Interactivity wiring               | `packages/client/src/dataLayers/LayerInteractivityManager.ts`           |

---

## Caveats and gotchas

1. **Nearest resampling only** for encoded tiles — bilinear destroys codes.
2. **`interval === 1` floors floats** — tile values may not equal geostats
   min/max exactly.
3. **`interval ≠ 1` and `base ≠ 0`:** style builders multiply the entire mix
   (including the offset term) by `interval`. That matches
   \(A = \text{interval}\cdot(N-32768)+\text{base}\) only when `base === 0` or
   when the offset expression is structured carefully; negative-base datasets
   today usually keep `interval = 1`.
4. **258 vs 255:** required for Mapbox GPU mix; client byte sampling uses exact
   65536/256/1 integer unpacking instead.
