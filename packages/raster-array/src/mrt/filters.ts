/**
 * MRT block filters, matching mapbox-gl-js `mrt.esm.js` semantics exactly.
 *
 * The decoder applies filters in reverse of their stored order, so an encoder
 * writing `["delta", "zigzag"]` must apply delta first, then zigzag. Delta is
 * spatial only: `deltaDecode` cumsums along the column axis then the row axis
 * of each band (blockShape `[bands, dim, dim, 1]` for uint32) and never
 * crosses the band axis. All arithmetic is mod 2^32 (Uint32Array wraparound),
 * so nodata sentinels (0xffffffff) round-trip through delta safely.
 */

export type MrtFilterName = "delta" | "zigzag";

/**
 * Difference-encode each band of a band-major block in place.
 * Inverse of the decoder's cumsum order (cols then rows): delta rows first,
 * then columns.
 */
export function deltaEncode(
  values: Uint32Array,
  bands: number,
  dim: number,
): Uint32Array {
  const perBand = dim * dim;
  for (let b = 0; b < bands; b++) {
    const base = b * perBand;
    for (let r = dim - 1; r >= 1; r--) {
      const row = base + r * dim;
      const prev = row - dim;
      for (let c = 0; c < dim; c++) {
        values[row + c] = (values[row + c] - values[prev + c]) >>> 0;
      }
    }
    for (let r = 0; r < dim; r++) {
      const row = base + r * dim;
      for (let c = dim - 1; c >= 1; c--) {
        values[row + c] = (values[row + c] - values[row + c - 1]) >>> 0;
      }
    }
  }
  return values;
}

/** Cumulative-sum decode; mirror of mapbox-gl's `deltaDecode`. */
export function deltaDecode(
  values: Uint32Array,
  bands: number,
  dim: number,
): Uint32Array {
  const perBand = dim * dim;
  for (let b = 0; b < bands; b++) {
    const base = b * perBand;
    for (let r = 0; r < dim; r++) {
      const row = base + r * dim;
      for (let c = 1; c < dim; c++) {
        values[row + c] = (values[row + c] + values[row + c - 1]) >>> 0;
      }
    }
    for (let r = 1; r < dim; r++) {
      const row = base + r * dim;
      const prev = row - dim;
      for (let c = 0; c < dim; c++) {
        values[row + c] = (values[row + c] + values[prev + c]) >>> 0;
      }
    }
  }
  return values;
}

/** Map signed deltas onto small positive varints, in place. */
export function zigzagEncode(values: Uint32Array): Uint32Array {
  for (let i = 0; i < values.length; i++) {
    const v = values[i] | 0;
    values[i] = ((v << 1) ^ (v >> 31)) >>> 0;
  }
  return values;
}

/** Mirror of mapbox-gl's `zigzagDecode`. */
export function zigzagDecode(values: Uint32Array): Uint32Array {
  for (let i = 0; i < values.length; i++) {
    values[i] = ((values[i] >>> 1) ^ -(values[i] & 1)) >>> 0;
  }
  return values;
}

/** Apply encode-side filters in stored order. Mutates and returns `values`. */
export function applyFilters(
  values: Uint32Array,
  filters: MrtFilterName[],
  bands: number,
  dim: number,
): Uint32Array {
  for (const filter of filters) {
    if (filter === "delta") deltaEncode(values, bands, dim);
    else if (filter === "zigzag") zigzagEncode(values);
    else throw new Error(`Unknown MRT filter "${filter}"`);
  }
  return values;
}

/** Undo filters in reverse stored order, matching the mapbox-gl decoder. */
export function undoFilters(
  values: Uint32Array,
  filters: string[],
  bands: number,
  dim: number,
): Uint32Array {
  for (let i = filters.length - 1; i >= 0; i--) {
    const filter = filters[i];
    if (filter === "delta_filter") deltaDecode(values, bands, dim);
    else if (filter === "zigzag_filter") zigzagDecode(values);
    else throw new Error(`Unhandled MRT filter "${filter}"`);
  }
  return values;
}
