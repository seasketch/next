/** PMTiles v3 directory / Hilbert helpers matching the official JS reader. */

export type DirectoryEntry = {
  tileId: number;
  offset: number;
  length: number;
  runLength: number;
};

export const HEADER_SIZE = 127;
export const TILE_TYPE_UNKNOWN = 0;
export const COMPRESSION_NONE = 1;
export const COMPRESSION_GZIP = 2;

export function zxyToTileId(z: number, x: number, y: number): number {
  if (z > 26) {
    throw new Error("Tile zoom level exceeds max safe number limit (26)");
  }
  if (x >= 1 << z || y >= 1 << z) {
    throw new Error("tile x/y outside zoom level bounds");
  }
  let acc = ((1 << z) * (1 << z) - 1) / 3;
  let a = z - 1;
  let tx = x;
  let ty = y;
  for (let s = 1 << a; s > 0; s >>= 1) {
    const rx = tx & s;
    const ry = ty & s;
    acc += ((3 * rx) ^ ry) * (1 << a);
    [tx, ty] = rotate(s, tx, ty, rx, ry);
    a--;
  }
  return acc;
}

export function tileIdToZxy(i: number): [number, number, number] {
  const z = tileIdToZ(i) >> 1;
  if (z > 26) {
    throw new Error("Tile zoom level exceeds max safe number limit (26)");
  }
  const acc = ((1 << z) * (1 << z) - 1) / 3;
  let t = i - acc;
  let x = 0;
  let y = 0;
  const n = 1 << z;
  for (let s = 1; s < n; s <<= 1) {
    const rx = s & (t / 2);
    const ry = s & (t ^ rx);
    [x, y] = rotate(s, x, y, rx, ry);
    t = t / 2;
    x += rx;
    y += ry;
  }
  return [z, x, y];
}

function rotate(
  n: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
): [number, number] {
  if (ry === 0) {
    if (rx !== 0) {
      return [n - 1 - y, n - 1 - x];
    }
    return [y, x];
  }
  return [x, y];
}

function tileIdToZ(i: number): number {
  const c = 3 * i + 1;
  if (c < 0x100000000) {
    return 31 - Math.clz32(c);
  }
  return 63 - Math.clz32(c / 0x100000000);
}

export function writeVarint(n: number, out: number[]): void {
  if (n < 0 || !Number.isFinite(n)) {
    throw new Error(`invalid varint ${n}`);
  }
  let value = n;
  while (value >= 0x80) {
    out.push((value & 0x7f) | 0x80);
    value = Math.floor(value / 128);
  }
  out.push(value);
}

export function readVarint(buf: Uint8Array, pos: { i: number }): number {
  let result = 0;
  let shift = 0;
  while (true) {
    const b = buf[pos.i]!;
    pos.i++;
    result += (b & 0x7f) * 2 ** shift;
    if (b < 0x80) return result;
    shift += 7;
    if (shift > 63) throw new Error("varint too long");
  }
}

export function serializeDirectory(entries: DirectoryEntry[]): Uint8Array {
  const out: number[] = [];
  writeVarint(entries.length, out);
  let lastId = 0;
  for (const entry of entries) {
    writeVarint(entry.tileId - lastId, out);
    lastId = entry.tileId;
  }
  for (const entry of entries) writeVarint(entry.runLength, out);
  for (const entry of entries) writeVarint(entry.length, out);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (
      i > 0 &&
      entry.offset === entries[i - 1]!.offset + entries[i - 1]!.length
    ) {
      writeVarint(0, out);
    } else {
      writeVarint(entry.offset + 1, out);
    }
  }
  return Uint8Array.from(out);
}

export function deserializeDirectory(buffer: Uint8Array): DirectoryEntry[] {
  const pos = { i: 0 };
  const numEntries = readVarint(buffer, pos);
  const entries: DirectoryEntry[] = [];
  let lastId = 0;
  for (let i = 0; i < numEntries; i++) {
    const v = readVarint(buffer, pos);
    entries.push({ tileId: lastId + v, offset: 0, length: 0, runLength: 1 });
    lastId += v;
  }
  for (let i = 0; i < numEntries; i++) {
    entries[i]!.runLength = readVarint(buffer, pos);
  }
  for (let i = 0; i < numEntries; i++) {
    entries[i]!.length = readVarint(buffer, pos);
  }
  for (let i = 0; i < numEntries; i++) {
    const v = readVarint(buffer, pos);
    if (v === 0 && i > 0) {
      entries[i]!.offset = entries[i - 1]!.offset + entries[i - 1]!.length;
    } else {
      entries[i]!.offset = v - 1;
    }
  }
  return entries;
}

/** Same lookup as the official PMTiles JS reader (leaf dirs use runLength 0). */
export function findTile(
  entries: DirectoryEntry[],
  tileId: number,
): DirectoryEntry | null {
  let m = 0;
  let n = entries.length - 1;
  while (m <= n) {
    const k = (n + m) >> 1;
    const cmp = tileId - entries[k]!.tileId;
    if (cmp > 0) {
      m = k + 1;
    } else if (cmp < 0) {
      n = k - 1;
    } else {
      return entries[k]!;
    }
  }
  if (n >= 0) {
    const entry = entries[n]!;
    if (entry.runLength === 0) return entry;
    if (tileId - entry.tileId < entry.runLength) return entry;
  }
  return null;
}

export type PmtilesHeader = {
  rootDirectoryOffset: number;
  rootDirectoryLength: number;
  jsonMetadataOffset: number;
  jsonMetadataLength: number;
  leafDirectoryOffset: number;
  leafDirectoryLength: number;
  tileDataOffset: number;
  tileDataLength: number;
  numAddressedTiles: number;
  numTileEntries: number;
  numTileContents: number;
  clustered: boolean;
  internalCompression: number;
  tileCompression: number;
  tileType: number;
  minZoom: number;
  maxZoom: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  centerZoom: number;
  centerLon: number;
  centerLat: number;
};

function writeUint64LE(view: DataView, offset: number, value: number): void {
  const low = value >>> 0;
  const high = Math.floor(value / 0x100000000);
  view.setUint32(offset, low, true);
  view.setUint32(offset + 4, high, true);
}

function readUint64LE(view: DataView, offset: number): number {
  const low = view.getUint32(offset, true);
  const high = view.getUint32(offset + 4, true);
  return high * 0x100000000 + low;
}

export function serializeHeader(header: PmtilesHeader): Buffer {
  const buf = Buffer.alloc(HEADER_SIZE);
  buf.write("PMTiles", 0, "ascii");
  buf[7] = 3;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  writeUint64LE(view, 8, header.rootDirectoryOffset);
  writeUint64LE(view, 16, header.rootDirectoryLength);
  writeUint64LE(view, 24, header.jsonMetadataOffset);
  writeUint64LE(view, 32, header.jsonMetadataLength);
  writeUint64LE(view, 40, header.leafDirectoryOffset);
  writeUint64LE(view, 48, header.leafDirectoryLength);
  writeUint64LE(view, 56, header.tileDataOffset);
  writeUint64LE(view, 64, header.tileDataLength);
  writeUint64LE(view, 72, header.numAddressedTiles);
  writeUint64LE(view, 80, header.numTileEntries);
  writeUint64LE(view, 88, header.numTileContents);
  buf[96] = header.clustered ? 1 : 0;
  buf[97] = header.internalCompression;
  buf[98] = header.tileCompression;
  buf[99] = header.tileType;
  buf[100] = header.minZoom;
  buf[101] = header.maxZoom;
  view.setInt32(102, Math.round(header.minLon * 1e7), true);
  view.setInt32(106, Math.round(header.minLat * 1e7), true);
  view.setInt32(110, Math.round(header.maxLon * 1e7), true);
  view.setInt32(114, Math.round(header.maxLat * 1e7), true);
  buf[118] = header.centerZoom;
  view.setInt32(119, Math.round(header.centerLon * 1e7), true);
  view.setInt32(123, Math.round(header.centerLat * 1e7), true);
  return buf;
}

export function deserializeHeader(buf: Uint8Array): PmtilesHeader {
  if (buf.length < HEADER_SIZE) {
    throw new Error("PMTiles header is truncated");
  }
  const magic = Buffer.from(buf.subarray(0, 7)).toString("ascii");
  if (magic !== "PMTiles" || buf[7] !== 3) {
    throw new Error(`Not a PMTiles v3 archive (${magic} v${buf[7]})`);
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    rootDirectoryOffset: readUint64LE(view, 8),
    rootDirectoryLength: readUint64LE(view, 16),
    jsonMetadataOffset: readUint64LE(view, 24),
    jsonMetadataLength: readUint64LE(view, 32),
    leafDirectoryOffset: readUint64LE(view, 40),
    leafDirectoryLength: readUint64LE(view, 48),
    tileDataOffset: readUint64LE(view, 56),
    tileDataLength: readUint64LE(view, 64),
    numAddressedTiles: readUint64LE(view, 72),
    numTileEntries: readUint64LE(view, 80),
    numTileContents: readUint64LE(view, 88),
    clustered: buf[96] === 1,
    internalCompression: buf[97]!,
    tileCompression: buf[98]!,
    tileType: buf[99]!,
    minZoom: buf[100]!,
    maxZoom: buf[101]!,
    minLon: view.getInt32(102, true) / 1e7,
    minLat: view.getInt32(106, true) / 1e7,
    maxLon: view.getInt32(110, true) / 1e7,
    maxLat: view.getInt32(114, true) / 1e7,
    centerZoom: buf[118]!,
    centerLon: view.getInt32(119, true) / 1e7,
    centerLat: view.getInt32(123, true) / 1e7,
  };
}
