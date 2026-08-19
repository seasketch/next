import { gunzipSync } from "zlib";
import { PbfReader } from "./pbf";
import {
  DecodedMrtLayer,
  DecodedMrtTile,
  MrtDataIndexEntry,
} from "./types";

/**
 * Parse an MRT v1 buffer produced by `encodeMrtTile` (or a compatible encoder).
 * Used for tests and the `inspect` CLI — Mapbox GL JS has its own decoder.
 */
export function decodeMrtTile(buf: Uint8Array | Buffer): DecodedMrtTile {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length < 5 || bytes[0] !== 0x0d) {
    throw new Error("File is not a valid MRT (missing 0x0d header tag).");
  }
  const headerLength = new DataView(
    bytes.buffer,
    bytes.byteOffset + 1,
    4,
  ).getUint32(0, true);
  if (bytes.length < headerLength) {
    throw new Error(
      `Expected header length ${headerLength} but buffer is ${bytes.length} bytes`,
    );
  }

  const pbf = new PbfReader(bytes.subarray(0, headerLength));
  const tile: DecodedMrtTile = {
    headerLength,
    x: 0,
    y: 0,
    z: 0,
    layers: {},
  };

  let field: number;
  while ((field = pbf.nextField())) {
    if (field === 1) tile.headerLength = pbf.readFixed32();
    else if (field === 2) tile.x = pbf.readVarint();
    else if (field === 3) tile.y = pbf.readVarint();
    else if (field === 4) tile.z = pbf.readVarint();
    else if (field === 5) {
      const layer = readLayer(pbf, bytes);
      tile.layers[layer.name] = layer;
    } else {
      pbf.skip();
    }
  }
  return tile;
}

export function getMrtHeaderLength(buf: Uint8Array | Buffer): number {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes[0] !== 0x0d) throw new Error("File is not a valid MRT.");
  return new DataView(bytes.buffer, bytes.byteOffset + 1, 4).getUint32(0, true);
}

function readLayer(pbf: PbfReader, file: Uint8Array): DecodedMrtLayer {
  const end = pbf.readVarint() + pbf.pos;
  const layer: DecodedMrtLayer = {
    version: 0,
    name: "",
    units: "",
    tileSize: 0,
    buffer: 0,
    pixelFormat: 0,
    dataIndex: [],
    bandData: {},
  };
  let field: number;
  while ((field = pbf.nextField(end))) {
    if (field === 1) layer.version = pbf.readVarint();
    else if (field === 2) layer.name = pbf.readString();
    else if (field === 3) layer.units = pbf.readString();
    else if (field === 4) layer.tileSize = pbf.readVarint();
    else if (field === 5) layer.buffer = pbf.readVarint();
    else if (field === 6) layer.pixelFormat = pbf.readVarint();
    else if (field === 7) layer.dataIndex.push(readDataIndexEntry(pbf));
    else pbf.skip();
  }

  const dim = layer.tileSize + 2 * layer.buffer;
  const samplesPerBand = dim * dim;
  for (const block of layer.dataIndex) {
    const slice = file.subarray(block.firstByte, block.lastByte + 1);
    const inflated = gunzipSync(slice);
    const values = readNumericData(inflated, block.bands.length * samplesPerBand);
    for (let i = 0; i < block.bands.length; i++) {
      const start = i * samplesPerBand;
      layer.bandData[block.bands[i]!] = values.subarray(
        start,
        start + samplesPerBand,
      );
    }
  }
  return layer;
}

function readDataIndexEntry(pbf: PbfReader): MrtDataIndexEntry {
  const end = pbf.readVarint() + pbf.pos;
  const entry: MrtDataIndexEntry = {
    firstByte: 0,
    lastByte: 0,
    bands: [],
    offset: 0,
    scale: 0,
    codec: "gzip_data",
    filters: [],
  };
  let field: number;
  while ((field = pbf.nextField(end))) {
    if (field === 1) entry.firstByte = pbf.readFixed64();
    else if (field === 2) entry.lastByte = pbf.readFixed64();
    else if (field === 3) {
      const filterEnd = pbf.readVarint() + pbf.pos;
      let f: number;
      while ((f = pbf.nextField(filterEnd))) {
        if (f === 1) {
          entry.filters.push("delta_filter");
          pbf.skip();
        } else if (f === 2) {
          entry.filters.push("zigzag_filter");
          pbf.skip();
        } else if (f === 3) {
          entry.filters.push("bitshuffle_filter");
          pbf.skip();
        } else if (f === 4) {
          entry.filters.push("byteshuffle_filter");
          pbf.skip();
        } else pbf.skip();
      }
    } else if (field === 4) {
      const codecEnd = pbf.readVarint() + pbf.pos;
      let c: number;
      while ((c = pbf.nextField(codecEnd))) {
        if (c === 1) {
          entry.codec = "gzip_data";
          pbf.skip();
        } else pbf.skip();
      }
    } else if (field === 5) entry.offset = pbf.readFloat();
    else if (field === 6) entry.scale = pbf.readFloat();
    else if (field === 7) entry.bands.push(pbf.readString());
    else if (field === 8) entry.offset = pbf.readDouble();
    else if (field === 9) entry.scale = pbf.readDouble();
    else pbf.skip();
  }
  return entry;
}

function readNumericData(buf: Buffer, expected: number): Uint32Array {
  const pbf = new PbfReader(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  const values = new Uint32Array(expected);
  let field: number;
  while ((field = pbf.nextField())) {
    if (field === 2) {
      const end = pbf.readVarint() + pbf.pos;
      let inner: number;
      while ((inner = pbf.nextField(end))) {
        if (inner === 1) {
          const valuesEnd = pbf.readVarint() + pbf.pos;
          let i = 0;
          while (pbf.pos < valuesEnd && i < expected) {
            values[i++] = pbf.readUint32Varint();
          }
        } else pbf.skip();
      }
    } else {
      pbf.skip();
    }
  }
  return values;
}
