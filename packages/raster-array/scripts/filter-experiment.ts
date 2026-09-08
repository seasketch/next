/**
 * One-off experiment: how much smaller would dhw-daily tiles be with
 * (a) spatial delta+zigzag filters (supported by mapbox-gl's MRT decoder),
 * (b) coarser quantization (0.1 instead of 0.01 °C-weeks),
 * (c) both?
 *
 * Usage: npx tsx scripts/filter-experiment.ts <tile.mrt> [bandsPerBlock]
 */
import { readFileSync } from "fs";
import { gzipSync } from "zlib";
import { decodeMrtTile } from "../src/mrt/decode";
import { PbfWriter } from "../src/mrt/pbf";

const NODATA = 0xffffffff;

function encodeNumericData(values: Uint32Array): Buffer {
  const uint32Values = new PbfWriter();
  uint32Values.writePackedUint32Field(1, values);
  const numeric = new PbfWriter();
  numeric.writeMessageField(2, uint32Values.finish());
  return numeric.finish();
}

/** Inverse of mapbox-gl's delta unfilter: per band, delta cols then rows. */
function deltaFilter(values: Uint32Array, bands: number, dim: number): Int32Array {
  const out = new Int32Array(values.length);
  out.set(values as unknown as Int32Array);
  const perBand = dim * dim;
  for (let b = 0; b < bands; b++) {
    const base = b * perBand;
    // rows first (inverse order of decoder which does cols then rows... the
    // decoder un-deltas axis2(cols) with stride 1, then axis1(rows) with
    // stride dim; so encode must delta rows first, then cols)
    for (let r = dim - 1; r >= 1; r--) {
      for (let c = 0; c < dim; c++) {
        out[base + r * dim + c] -= out[base + (r - 1) * dim + c];
      }
    }
    for (let r = 0; r < dim; r++) {
      for (let c = dim - 1; c >= 1; c--) {
        out[base + r * dim + c] -= out[base + r * dim + c - 1];
      }
    }
  }
  return out;
}

function zigzag(values: Int32Array): Uint32Array {
  const out = new Uint32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out[i] = ((v << 1) ^ (v >> 31)) >>> 0;
  }
  return out;
}

/** Requantize codes from scale 0.01 to 0.1 (divide by 10), keeping nodata. */
function requantize(values: Uint32Array, factor: number): Uint32Array {
  const out = new Uint32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    out[i] = values[i] === NODATA ? NODATA : Math.round(values[i] / factor);
  }
  return out;
}

/** Replace 5-byte nodata sentinel with 0 and shift codes up by 1. */
function nodataAsZero(values: Uint32Array): Uint32Array {
  const out = new Uint32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    out[i] = values[i] === NODATA ? 0 : values[i] + 1;
  }
  return out;
}

const [, , tilePath, bpbArg] = process.argv;
const bandsPerBlock = Number(bpbArg || 16);
const tile = decodeMrtTile(readFileSync(tilePath));
const layer = Object.values(tile.layers)[0];
const dim = layer.tileSize + 2 * layer.buffer;
const perBand = dim * dim;
const bandIds = Object.keys(layer.bandData);

function totalSize(transform: (block: Uint32Array, nBands: number) => Uint32Array): number {
  let total = 0;
  for (let i = 0; i < bandIds.length; i += bandsPerBlock) {
    const group = bandIds.slice(i, i + bandsPerBlock);
    const block = new Uint32Array(group.length * perBand);
    group.forEach((id, j) => block.set(layer.bandData[id], j * perBand));
    const transformed = transform(block, group.length);
    total += gzipSync(encodeNumericData(transformed), { level: 6 }).length;
  }
  return total;
}

const mb = (n: number) => (n / 1048576).toFixed(2) + " MB";

const baseline = totalSize((b) => b);
console.log(`tile ${tilePath.split("/").slice(-3).join("/")}, ${bandIds.length} bands, dim ${dim}, bandsPerBlock ${bandsPerBlock}`);
console.log(`baseline (current encoder):           ${mb(baseline)}`);

const dz = totalSize((b, n) => zigzag(deltaFilter(b, n, dim)));
console.log(`delta+zigzag:                          ${mb(dz)}  (${((dz / baseline) * 100).toFixed(0)}%)`);

const q10 = totalSize((b) => requantize(b, 10));
console.log(`quantize 0.1:                          ${mb(q10)}  (${((q10 / baseline) * 100).toFixed(0)}%)`);

const q10dz = totalSize((b, n) => zigzag(deltaFilter(requantize(b, 10), n, dim)));
console.log(`quantize 0.1 + delta+zigzag:           ${mb(q10dz)}  (${((q10dz / baseline) * 100).toFixed(0)}%)`);

const nz = totalSize((b) => nodataAsZero(b));
console.log(`nodata->0 only:                        ${mb(nz)}  (${((nz / baseline) * 100).toFixed(0)}%)`);

const all = totalSize((b, n) => zigzag(deltaFilter(nodataAsZero(requantize(b, 10)), n, dim)));
console.log(`quantize 0.1 + nodata->0 + delta+zz:   ${mb(all)}  (${((all / baseline) * 100).toFixed(0)}%)`);
