import { gzipSync } from "zlib";
import { PbfWriter } from "./pbf";
import {
  EncodeMrtTileOptions,
  MRT_VERSION,
  MrtLayerInput,
  PIXEL_FORMAT_UINT32,
} from "./types";

/**
 * Serialize one Web Mercator tile as MRT v1.
 *
 * Layout (see mapbox-gl-js `mrt.esm.js`):
 *   protobuf TileHeader (field 1 is headerLength as fixed32; tag 0x0d is the
 *   "magic" byte the decoder checks) followed by gzipped NumericData blocks
 *   addressed by each layer's dataIndex firstByte/lastByte (inclusive).
 *
 * Pixel values are uint32 varints inside:
 *   NumericData { uint32_values = 2 { packed values = 1 } }
 * then gzip (not raw deflate). Filters are omitted in this encoder.
 */
export function encodeMrtTile(options: EncodeMrtTileOptions): Buffer {
  const { z, x, y, layers } = options;
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error("z/x/y must be integers");
  }
  if (layers.length === 0) {
    throw new Error("At least one layer is required");
  }

  const preparedLayers = layers.map((layer) => prepareLayer(layer));

  // Compress every block first. firstByte/lastByte are fixed64, so header size
  // does not depend on the offset values themselves — only on counts/names.
  const dummyHeader = serializeHeader(x, y, z, preparedLayers, 0);
  const headerLength = dummyHeader.length;
  placeBlocks(preparedLayers, headerLength);
  const header = serializeHeader(x, y, z, preparedLayers, headerLength);
  if (header.length !== headerLength) {
    throw new Error(
      `MRT header size changed after placing blocks (${header.length} vs ${headerLength})`,
    );
  }

  const parts: Buffer[] = [header];
  for (const layer of preparedLayers) {
    for (const block of layer.blocks) {
      parts.push(block.bytes);
    }
  }
  return Buffer.concat(parts);
}

type PreparedBlock = {
  bands: string[];
  offset: number;
  scale: number;
  bytes: Buffer;
  firstByte: number;
  lastByte: number;
};

type PreparedLayer = {
  input: MrtLayerInput;
  blocks: PreparedBlock[];
};

function prepareLayer(layer: MrtLayerInput): PreparedLayer {
  if (layer.tileSize < 1 || (layer.tileSize & (layer.tileSize - 1)) !== 0) {
    throw new Error(`tileSize must be a power of two, got ${layer.tileSize}`);
  }
  if (layer.buffer < 0 || !Number.isInteger(layer.buffer)) {
    throw new Error("buffer must be a non-negative integer");
  }
  if (layer.bands.length === 0) {
    throw new Error(`Layer "${layer.name}" has no bands`);
  }
  const dim = layer.tileSize + 2 * layer.buffer;
  const expected = dim * dim;
  for (const band of layer.bands) {
    if (band.values.length !== expected) {
      throw new Error(
        `Band "${band.id}" in layer "${layer.name}" has ${band.values.length} samples, expected ${expected} (${dim}×${dim})`,
      );
    }
  }

  const offset = layer.offset ?? 0;
  const scale = layer.scale ?? 1;
  if (scale === 0) {
    throw new Error("scale must be non-zero");
  }

  const groups = groupBands(layer.bands, layer.bandsPerBlock ?? "all");
  const blocks: PreparedBlock[] = groups.map((group) => {
    const values = concatBandMajor(group.map((b) => b.values));
    return {
      bands: group.map((b) => b.id),
      offset,
      scale,
      bytes: gzipSync(encodeNumericData(values), { level: 9 }),
      firstByte: 0,
      lastByte: 0,
    };
  });

  return { input: layer, blocks };
}

function groupBands<T>(bands: T[], bandsPerBlock: number | "all"): T[][] {
  if (bandsPerBlock === "all" || bandsPerBlock >= bands.length) {
    return [bands];
  }
  if (!Number.isInteger(bandsPerBlock) || bandsPerBlock < 1) {
    throw new Error("bandsPerBlock must be a positive integer or \"all\"");
  }
  const groups: T[][] = [];
  for (let i = 0; i < bands.length; i += bandsPerBlock) {
    groups.push(bands.slice(i, i + bandsPerBlock));
  }
  return groups;
}

function concatBandMajor(bands: Uint32Array[]): Uint32Array {
  let total = 0;
  for (const b of bands) total += b.length;
  const out = new Uint32Array(total);
  let offset = 0;
  for (const b of bands) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

/**
 * NumericData protobuf:
 *   field 2 = Uint32Values { field 1 = packed uint32 varints }
 */
function encodeNumericData(values: Uint32Array): Buffer {
  const uint32Values = new PbfWriter();
  uint32Values.writePackedUint32Field(1, values);
  const numeric = new PbfWriter();
  numeric.writeMessageField(2, uint32Values.finish());
  return numeric.finish();
}

function placeBlocks(layers: PreparedLayer[], headerLength: number): void {
  let cursor = headerLength;
  for (const layer of layers) {
    for (const block of layer.blocks) {
      block.firstByte = cursor;
      block.lastByte = cursor + block.bytes.length - 1;
      cursor = block.lastByte + 1;
    }
  }
}

function serializeHeader(
  x: number,
  y: number,
  z: number,
  layers: PreparedLayer[],
  _headerLength: number,
): Buffer {
  const rest = new PbfWriter();
  rest.writeVarintField(2, x);
  rest.writeVarintField(3, y);
  rest.writeVarintField(4, z);
  for (const layer of layers) {
    rest.writeMessageField(5, serializeLayer(layer));
  }
  const restBuf = rest.finish();
  const headerLength = 1 + 4 + restBuf.length;
  const header = new PbfWriter();
  header.writeFixed32Field(1, headerLength);
  header.writeRaw(restBuf);
  return header.finish();
}

function serializeLayer(layer: PreparedLayer): Buffer {
  const { input, blocks } = layer;
  const w = new PbfWriter();
  w.writeVarintField(1, MRT_VERSION);
  w.writeStringField(2, input.name);
  if (input.units) w.writeStringField(3, input.units);
  w.writeVarintField(4, input.tileSize);
  w.writeVarintField(5, input.buffer);
  w.writeVarintField(6, PIXEL_FORMAT_UINT32);
  for (const block of blocks) {
    w.writeMessageField(7, serializeDataIndexEntry(block));
  }
  return w.finish();
}

function serializeDataIndexEntry(block: PreparedBlock): Buffer {
  const w = new PbfWriter();
  w.writeFixed64Field(1, block.firstByte);
  w.writeFixed64Field(2, block.lastByte);
  w.writeMessageField(4, serializeGzipCodec());
  // GL JS 3.4 reads offset/scale as protobuf floats on fields 5/6
  // (`mrt_pbf_decoder.js`). Fields 8/9 doubles are ignored by that decoder.
  w.writeFloatField(5, block.offset);
  w.writeFloatField(6, block.scale);
  for (const band of block.bands) {
    w.writeStringField(7, band);
  }
  return w.finish();
}

/** Codec { gzip_data = 1 { } } — empty nested message, length-delimited. */
function serializeGzipCodec(): Buffer {
  const w = new PbfWriter();
  w.writeMessageField(1, Buffer.alloc(0));
  return w.finish();
}

/** Quantize a physical value into an MRT uint32 code. */
export function encodeSample(
  value: number,
  offset: number,
  scale: number,
  nodata?: number | null,
): number {
  if (
    value === nodata ||
    value == null ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return 0xffffffff;
  }
  const code = Math.round((value - offset) / scale);
  if (code < 0 || code >= 0xffffffff) {
    return 0xffffffff;
  }
  return code >>> 0;
}

export function decodeSample(
  code: number,
  offset: number,
  scale: number,
): number | null {
  if (code === 0xffffffff) return null;
  return offset + scale * code;
}
