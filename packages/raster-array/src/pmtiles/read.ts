import { gunzipSync } from "zlib";
import { openSync, readSync } from "fs";
import {
  COMPRESSION_GZIP,
  COMPRESSION_NONE,
  DirectoryEntry,
  HEADER_SIZE,
  deserializeDirectory,
  deserializeHeader,
  findTile,
  zxyToTileId,
  type PmtilesHeader,
} from "./codec";

export type OpenedPmtiles = {
  header: PmtilesHeader;
  metadata: Record<string, unknown>;
  getTile: (z: number, x: number, y: number) => Buffer | null;
};

type ByteSource = (offset: number, length: number) => Buffer;

function openPmtilesSource(readAt: ByteSource): OpenedPmtiles {
  const header = deserializeHeader(readAt(0, HEADER_SIZE));
  const metadataBytes = inflate(
    readAt(header.jsonMetadataOffset, header.jsonMetadataLength),
    header.internalCompression,
  );
  const metadata = JSON.parse(metadataBytes.toString("utf8")) as Record<
    string,
    unknown
  >;
  const root = deserializeDirectory(
    inflate(
      readAt(header.rootDirectoryOffset, header.rootDirectoryLength),
      header.internalCompression,
    ),
  );

  const getTile = (z: number, x: number, y: number): Buffer | null => {
    const tileId = zxyToTileId(z, x, y);
    let entry = findTile(root, tileId);
    if (!entry) return null;
    if (entry.runLength === 0) {
      const leaf = deserializeDirectory(
        inflate(
          readAt(
            header.leafDirectoryOffset + entry.offset,
            entry.length,
          ),
          header.internalCompression,
        ),
      );
      entry = findTile(leaf, tileId);
      if (!entry || entry.runLength === 0) return null;
    }
    return readAt(header.tileDataOffset + entry.offset, entry.length);
  };

  return { header, metadata, getTile };
}

/** Open an archive without loading the whole file (needed for multi-GB GMW). */
export function openPmtiles(path: string): OpenedPmtiles {
  const fd = openSync(path, "r");
  return openPmtilesSource((offset, length) => {
    const buf = Buffer.alloc(length);
    const n = readSync(fd, buf, 0, length, offset);
    if (n !== length) {
      throw new Error(`PMTiles short read at ${offset} (wanted ${length}, got ${n})`);
    }
    return buf;
  });
}

export function openPmtilesBytes(archive: Buffer): OpenedPmtiles {
  return openPmtilesSource((offset, length) =>
    Buffer.from(archive.subarray(offset, offset + length)),
  );
}

function inflate(buf: Uint8Array, compression: number): Buffer {
  if (compression === COMPRESSION_NONE) return Buffer.from(buf);
  if (compression === COMPRESSION_GZIP) return gunzipSync(buf);
  throw new Error(`Unsupported PMTiles compression ${compression}`);
}

export function listRootEntries(archive: Buffer): DirectoryEntry[] {
  const header = deserializeHeader(archive.subarray(0, HEADER_SIZE));
  return deserializeDirectory(
    inflate(
      archive.subarray(
        header.rootDirectoryOffset,
        header.rootDirectoryOffset + header.rootDirectoryLength,
      ),
      header.internalCompression,
    ),
  );
}
