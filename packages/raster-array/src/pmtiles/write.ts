import { createHash } from "crypto";
import {
  closeSync,
  createReadStream,
  createWriteStream,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "fs";
import { dirname } from "path";
import { pipeline } from "stream/promises";
import { gzipSync } from "zlib";
import {
  COMPRESSION_GZIP,
  COMPRESSION_NONE,
  DirectoryEntry,
  HEADER_SIZE,
  TILE_TYPE_UNKNOWN,
  serializeDirectory,
  serializeHeader,
  zxyToTileId,
} from "./codec";

export type PmtilesTile = {
  z: number;
  x: number;
  y: number;
  data: Buffer;
};

export type PmtilesTileFile = {
  z: number;
  x: number;
  y: number;
  path: string;
};

export type WritePmtilesOptions = {
  tiles: PmtilesTile[];
  metadata: Record<string, unknown>;
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
  center?: [number, number, number];
  /** Target gzipped root-directory size before splitting into leaves. */
  targetRootBytes?: number;
};

export type WrittenPmtiles = {
  bytes: Buffer;
  tileCount: number;
  addressedTiles: number;
  tileEntries: number;
  tileContents: number;
  bytesOut: number;
};

const DEFAULT_TARGET_ROOT = 16384;

export function writePmtilesArchive(options: WritePmtilesOptions): WrittenPmtiles {
  if (options.tiles.length === 0) {
    throw new Error("Cannot write an empty PMTiles archive");
  }

  const sorted = options.tiles
    .map((tile) => ({
      tileId: zxyToTileId(tile.z, tile.x, tile.y),
      data: tile.data,
    }))
    .sort((a, b) => a.tileId - b.tileId);

  const seen = new Set<number>();
  for (const tile of sorted) {
    if (seen.has(tile.tileId)) {
      throw new Error(`Duplicate tile id ${tile.tileId}`);
    }
    seen.add(tile.tileId);
  }

  const contentOffsetByHash = new Map<string, number>();
  const tileData: Buffer[] = [];
  let tileDataBytes = 0;
  let numTileContents = 0;
  const prepared: Array<{ tileId: number; offset: number; length: number }> = [];

  for (const tile of sorted) {
    const hash = createHash("sha256").update(tile.data).digest("hex");
    const existing = contentOffsetByHash.get(hash);
    if (existing !== undefined) {
      prepared.push({
        tileId: tile.tileId,
        offset: existing,
        length: tile.data.length,
      });
      continue;
    }
    contentOffsetByHash.set(hash, tileDataBytes);
    prepared.push({
      tileId: tile.tileId,
      offset: tileDataBytes,
      length: tile.data.length,
    });
    tileData.push(tile.data);
    tileDataBytes += tile.data.length;
    numTileContents++;
  }

  const prefix = archivePrefix({
    prepared,
    tileDataBytes,
    numTileContents,
    addressedTiles: sorted.length,
    zooms: options.tiles.map((t) => t.z),
    options,
  });
  const bytes = Buffer.concat([prefix.bytes, ...tileData]);
  return {
    bytes,
    tileCount: sorted.length,
    addressedTiles: sorted.length,
    tileEntries: prefix.tileEntries,
    tileContents: numTileContents,
    bytesOut: bytes.length,
  };
}

/**
 * Pack tiles from disk without holding the whole archive in RAM.
 * Used for the GMW globe (~38k tiles / ~1.8 GB).
 */
export async function writePmtilesArchiveToFile(options: {
  tiles: PmtilesTileFile[];
  outputPath: string;
  metadata: Record<string, unknown>;
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
  center?: [number, number, number];
  targetRootBytes?: number;
}): Promise<Omit<WrittenPmtiles, "bytes"> & { outputPath: string }> {
  if (options.tiles.length === 0) {
    throw new Error("Cannot write an empty PMTiles archive");
  }

  const sorted = options.tiles
    .map((tile) => ({
      tileId: zxyToTileId(tile.z, tile.x, tile.y),
      path: tile.path,
    }))
    .sort((a, b) => a.tileId - b.tileId);

  const seen = new Set<number>();
  for (const tile of sorted) {
    if (seen.has(tile.tileId)) {
      throw new Error(`Duplicate tile id ${tile.tileId}`);
    }
    seen.add(tile.tileId);
  }

  mkdirSync(dirname(options.outputPath), { recursive: true });
  const blobPath = `${options.outputPath}.tiledata`;
  const blobFd = openSync(blobPath, "w");
  const contentOffsetByHash = new Map<string, number>();
  const prepared: Array<{ tileId: number; offset: number; length: number }> = [];
  let tileDataBytes = 0;
  let numTileContents = 0;

  try {
    for (const tile of sorted) {
      const data = readFileSync(tile.path);
      const hash = createHash("sha256").update(data).digest("hex");
      const existing = contentOffsetByHash.get(hash);
      if (existing !== undefined) {
        prepared.push({
          tileId: tile.tileId,
          offset: existing,
          length: data.length,
        });
        continue;
      }
      contentOffsetByHash.set(hash, tileDataBytes);
      writeSync(blobFd, data);
      prepared.push({
        tileId: tile.tileId,
        offset: tileDataBytes,
        length: data.length,
      });
      tileDataBytes += data.length;
      numTileContents++;
    }
  } finally {
    closeSync(blobFd);
  }

  const prefix = archivePrefix({
    prepared,
    tileDataBytes,
    numTileContents,
    addressedTiles: sorted.length,
    zooms: options.tiles.map((t) => t.z),
    options,
  });

  const outFd = openSync(options.outputPath, "w");
  try {
    writeSync(outFd, prefix.bytes);
  } finally {
    closeSync(outFd);
  }
  await pipeline(
    createReadStream(blobPath),
    createWriteStream(options.outputPath, { flags: "a" }),
  );
  try {
    unlinkSync(blobPath);
  } catch {
    /* ignore */
  }

  return {
    outputPath: options.outputPath,
    tileCount: sorted.length,
    addressedTiles: sorted.length,
    tileEntries: prefix.tileEntries,
    tileContents: numTileContents,
    bytesOut: prefix.bytes.length + tileDataBytes,
  };
}

function archivePrefix(input: {
  prepared: Array<{ tileId: number; offset: number; length: number }>;
  tileDataBytes: number;
  numTileContents: number;
  addressedTiles: number;
  zooms: number[];
  options: {
    metadata: Record<string, unknown>;
    minzoom?: number;
    maxzoom?: number;
    bounds?: [number, number, number, number];
    center?: [number, number, number];
    targetRootBytes?: number;
  };
}): { bytes: Buffer; tileEntries: number } {
  const entries = collapseRuns(input.prepared);
  const { root, leaves } = optimizeDirectories(
    entries,
    input.options.targetRootBytes ?? DEFAULT_TARGET_ROOT,
  );
  const metadataGzip = gzipSync(
    Buffer.from(JSON.stringify(input.options.metadata), "utf8"),
  );
  const rootOffset = HEADER_SIZE;
  const metadataOffset = rootOffset + root.length;
  const leafOffset = metadataOffset + metadataGzip.length;
  const tileOffset = leafOffset + leaves.length;
  const minzoom = input.options.minzoom ?? Math.min(...input.zooms);
  const maxzoom = input.options.maxzoom ?? Math.max(...input.zooms);
  const bounds = input.options.bounds ?? [-180, -85.051129, 180, 85.051129];
  const center = input.options.center ?? [
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
    Math.min(maxzoom, minzoom + 2),
  ];
  const header = serializeHeader({
    rootDirectoryOffset: rootOffset,
    rootDirectoryLength: root.length,
    jsonMetadataOffset: metadataOffset,
    jsonMetadataLength: metadataGzip.length,
    leafDirectoryOffset: leaves.length ? leafOffset : 0,
    leafDirectoryLength: leaves.length,
    tileDataOffset: tileOffset,
    tileDataLength: input.tileDataBytes,
    numAddressedTiles: input.addressedTiles,
    numTileEntries: entries.length,
    numTileContents: input.numTileContents,
    clustered: true,
    internalCompression: COMPRESSION_GZIP,
    tileCompression: COMPRESSION_NONE,
    tileType: TILE_TYPE_UNKNOWN,
    minZoom: minzoom,
    maxZoom: maxzoom,
    minLon: bounds[0],
    minLat: bounds[1],
    maxLon: bounds[2],
    maxLat: bounds[3],
    centerZoom: center[2],
    centerLon: center[0],
    centerLat: center[1],
  });
  return {
    bytes: Buffer.concat([header, root, metadataGzip, leaves]),
    tileEntries: entries.length,
  };
}

function collapseRuns(tiles: Array<{ tileId: number; offset: number; length: number }>) {
  const entries: DirectoryEntry[] = [];
  for (const tile of tiles) {
    const last = entries[entries.length - 1];
    if (
      last &&
      last.offset === tile.offset &&
      last.length === tile.length &&
      last.tileId + last.runLength === tile.tileId
    ) {
      last.runLength += 1;
      continue;
    }
    entries.push({
      tileId: tile.tileId,
      offset: tile.offset,
      length: tile.length,
      runLength: 1,
    });
  }
  return entries;
}

function optimizeDirectories(
  entries: DirectoryEntry[],
  targetRootBytes: number,
): { root: Buffer; leaves: Buffer } {
  const rootOnly = gzipSync(Buffer.from(serializeDirectory(entries)));
  if (rootOnly.length <= targetRootBytes || entries.length <= 1) {
    return { root: rootOnly, leaves: Buffer.alloc(0) };
  }

  let leafSize = 4096;
  while (leafSize >= 1) {
    const leafChunks: Buffer[] = [];
    const rootEntries: DirectoryEntry[] = [];
    let leafOffset = 0;
    for (let i = 0; i < entries.length; i += leafSize) {
      const chunk = entries.slice(i, i + leafSize);
      const leaf = gzipSync(Buffer.from(serializeDirectory(chunk)));
      rootEntries.push({
        tileId: chunk[0]!.tileId,
        offset: leafOffset,
        length: leaf.length,
        runLength: 0,
      });
      leafChunks.push(leaf);
      leafOffset += leaf.length;
    }
    const root = gzipSync(Buffer.from(serializeDirectory(rootEntries)));
    if (root.length <= targetRootBytes) {
      return { root, leaves: Buffer.concat(leafChunks) };
    }
    leafSize = Math.max(1, Math.floor(leafSize / 2));
    if (leafSize === 1 && root.length > targetRootBytes) {
      return { root, leaves: Buffer.concat(leafChunks) };
    }
  }
  throw new Error("Failed to build PMTiles directories");
}
