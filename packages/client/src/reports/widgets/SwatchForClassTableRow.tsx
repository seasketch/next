import type { ClassTableRow } from "./ClassTableRows";

const GRID_SIZE = 6;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

/** Deterministic PRNG for stable “random” mosaics per row (Strict Mode–safe). */
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

/**
 * Multiset of length CELL_COUNT with roughly equal counts per palette color, then
 * Fisher–Yates shuffled with a seeded RNG.
 */
function mosaicPixelsFromPalette(colors: string[], seed: number): string[] {
  const palette = samplePaletteToMax(colors, CELL_COUNT);
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
  const rng = mulberry32(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
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
 * Renders a small color swatch for a ClassTableRow. Returns null if the row
 * has no color info. Single literal color uses a solid square. Multiple palette
 * colors use a 6×6 mosaic of pixels with roughly balanced color counts and a
 * deterministic shuffle so it reads a bit like a categorical map.
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

    const seed = hashString(`${row.key}|${colors.join("|")}`);
    const pixels = mosaicPixelsFromPalette(colors, seed);

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
