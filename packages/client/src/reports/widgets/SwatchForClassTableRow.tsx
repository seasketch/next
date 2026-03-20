import type { ClassTableRow } from "./ClassTableRows";

const GRID_SIZE = 6;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
/** Random pairwise swaps after hue-sort; lower = clumpier, higher = closer to uniform random. */
const SOFT_SCATTER_SWAP_COUNT = 22;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePaletteToMax(colors: string[], max: number): string[] {
  if (colors.length <= max) return [...colors];
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i / (max - 1)) * (colors.length - 1));
    out.push(colors[idx]);
  }
  return out;
}

function buildBalancedPool(palette: string[]): string[] {
  const k = palette.length;
  const pool: string[] = [];
  const base = Math.floor(CELL_COUNT / k);
  const extra = CELL_COUNT % k;
  for (let i = 0; i < k; i++) {
    const count = base + (i < extra ? 1 : 0);
    for (let j = 0; j < count; j++) {
      pool.push(palette[i]);
    }
  }
  return pool;
}

function parseColorToRgb(s: string): { r: number; g: number; b: number } | null {
  const t = s.trim();
  const hex = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return { r, g, b };
  }
  const rgb = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) {
    return {
      r: Number(rgb[1]) / 255,
      g: Number(rgb[2]) / 255,
      b: Number(rgb[3]) / 255,
    };
  }
  return null;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function compareColorsForMosaic(a: string, b: string): number {
  const ra = parseColorToRgb(a);
  const rb = parseColorToRgb(b);
  if (!ra && !rb) return a.localeCompare(b);
  if (!ra) return 1;
  if (!rb) return -1;
  const ha = rgbToHsl(ra.r, ra.g, ra.b);
  const hb = rgbToHsl(rb.r, rb.g, rb.b);
  if (ha.h !== hb.h) return ha.h - hb.h;
  if (ha.s !== hb.s) return ha.s - hb.s;
  if (ha.l !== hb.l) return ha.l - hb.l;
  return a.localeCompare(b);
}

function partialShuffle(pool: string[], seed: number, swapCount: number): void {
  const rng = mulberry32(seed);
  for (let n = 0; n < swapCount; n++) {
    const a = Math.floor(rng() * pool.length);
    const b = Math.floor(rng() * pool.length);
    [pool[a], pool[b]] = [pool[b], pool[a]];
  }
}

/** Continuous / stepped raster ramps: pixels follow stop order (row-major). */
function rampOrderedMosaic(colors: string[]): string[] {
  const palette = samplePaletteToMax(colors, CELL_COUNT);
  const firstIndex = new Map<string, number>();
  palette.forEach((c, i) => {
    if (!firstIndex.has(c)) firstIndex.set(c, i);
  });
  const pool = buildBalancedPool(palette);
  pool.sort((a, b) => {
    const ia = firstIndex.get(a) ?? 0;
    const ib = firstIndex.get(b) ?? 0;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
  return pool;
}

/** Categorical / vectors: hue-sorted clumps, then a light seeded shuffle. */
function softScatterMosaic(colors: string[], seed: number): string[] {
  const palette = samplePaletteToMax(colors, CELL_COUNT);
  const pool = buildBalancedPool(palette);
  pool.sort(compareColorsForMosaic);
  partialShuffle(pool, seed, SOFT_SCATTER_SWAP_COUNT);
  return pool;
}

/**
 * Returns true if the row has any color information to show in a swatch
 * (single color or colors array).
 */
export function classTableRowHasSwatch(row: ClassTableRow): boolean {
  return !!(row.color || (row.colors && row.colors.length > 0));
}

type SwatchForClassTableRowProps = {
  row: ClassTableRow;
};

/**
 * Renders a small color swatch for a ClassTableRow. Multi-color palettes use a
 * 6×6 pixel grid: ramp order for continuous raster ramps, soft scatter for the rest.
 */
export function SwatchForClassTableRow({ row }: SwatchForClassTableRowProps) {
  if (!classTableRowHasSwatch(row)) {
    return null;
  }

  if (row.color) {
    return (
      <div className="flex-none w-4 flex justify-center">
        <span
          className="inline-block w-4 h-4 rounded-sm overflow-hidden"
          style={{ backgroundColor: row.color }}
          aria-hidden
        />
      </div>
    );
  }

  if (row.colors && row.colors.length > 0) {
    const colors = row.colors;
    if (colors.length === 1) {
      return (
        <div className="flex-none w-4 flex justify-center">
          <span
            className="inline-block w-4 h-4 rounded-sm overflow-hidden"
            style={{ backgroundColor: colors[0] }}
            aria-hidden
          />
        </div>
      );
    }

    const layout = row.multiColorSwatchLayout ?? "soft-scatter";
    const seed = hashString(`${row.key}|${colors.join("|")}`);
    const pixels =
      layout === "raster-ramp-order"
        ? rampOrderedMosaic(colors)
        : softScatterMosaic(colors, seed);

    return (
      <div className="flex-none w-4 flex justify-center">
        <span
          className="inline-grid grid-cols-6 grid-rows-6 gap-0 w-4 h-4 rounded-sm overflow-hidden [&>span]:min-w-0 [&>span]:min-h-0"
          aria-hidden
        >
          {pixels.map((c, i) => (
            <span key={i} className="block" style={{ backgroundColor: c }} />
          ))}
        </span>
      </div>
    );
  }

  return null;
}
