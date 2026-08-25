/**
 * Types for the MRT v1 subset consumed by mapbox-gl-js `src/data/mrt/mrt.esm.js`.
 *
 * MRT is not a published interchange spec. This encoder targets the decoder
 * shipped with Mapbox GL JS 3.1+ (SeaSketch is on 3.4). DataIndexEntry
 * offset/scale are protobuf floats on fields 5/6 (`mrt_pbf_decoder.js`).
 */

/** Reserved encoded value (2^32 - 1). Mapbox treats this as a masked pixel. */
export const MRT_NODATA = 0xffffffff;

/** Major version required by MapboxRasterLayer. */
export const MRT_VERSION = 1;

/**
 * Pixel-format enum stored in the layer protobuf.
 * Decoder maps 0 and 1 → uint32, 2 → uint16, 3 → uint8.
 * uint32 is the quantitative format described by Raster MTS.
 */
export const PIXEL_FORMAT_UINT32 = 1;

export type PixelFormatName = "uint32" | "uint16" | "uint8";

export type MrtBandInput = {
  id: string;
  /**
   * Encoded uint32 samples, row-major, north-up, including buffer pixels.
   * Length must equal (tileSize + 2 * buffer) ** 2.
   */
  values: Uint32Array;
};

export type MrtLayerInput = {
  name: string;
  units?: string;
  /** Interior tile size (power of two). Buffer is extra pixels around it. */
  tileSize: number;
  buffer: number;
  offset?: number;
  scale?: number;
  bands: MrtBandInput[];
  /**
   * How many bands share one gzipped, range-addressable block.
   * `"all"` (default) is best for animation: one fetch, then band switches
   * are GPU-only. `1` is best for first-paint of a single year.
   */
  bandsPerBlock?: number | "all";
};

export type EncodeMrtTileOptions = {
  z: number;
  x: number;
  y: number;
  layers: MrtLayerInput[];
  /** zlib level for NumericData blocks. Default 9; 6 is faster for large cubes. */
  gzipLevel?: number;
};

export type MrtDataIndexEntry = {
  firstByte: number;
  lastByte: number;
  bands: string[];
  offset: number;
  scale: number;
  codec: "gzip_data";
  filters: string[];
};

export type DecodedMrtLayer = {
  version: number;
  name: string;
  units: string;
  tileSize: number;
  buffer: number;
  pixelFormat: number;
  dataIndex: MrtDataIndexEntry[];
  /** Decoded uint32 samples keyed by band id, after gunzip + protobuf. */
  bandData: Record<string, Uint32Array>;
};

export type DecodedMrtTile = {
  headerLength: number;
  x: number;
  y: number;
  z: number;
  layers: Record<string, DecodedMrtLayer>;
};
