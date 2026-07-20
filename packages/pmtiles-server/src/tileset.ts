import {
  Compression,
  EtagMismatch,
  PMTiles,
  RangeResponse,
  ResolvedValueCache,
  Source,
} from "pmtiles";
import {
  fetchArchivePrefix,
  PMTILES_PREFIX_LENGTH,
} from "./archivePrefixCache";
import { KeyNotFoundError } from "./errors";
import { getTiming } from "./timing";

export { KeyNotFoundError } from "./errors";

interface VectorLayer {
  id: string;
  fields: { [attributeName: string]: string };
  description?: string;
  minzoom?: number;
  maxzoom?: number;
}

/** TileJSON subset returned by pmtiles for Mapbox / preview consumers. */
export interface TileJSON {
  tilejson: string;
  tiles: string[];
  vector_layers: VectorLayer[];
  attribution?: string;
  bounds?: [number, number, number, number];
  center?: [number, number, number];
  data?: string[];
  description?: string;
  fillzoom?: number;
  grids?: string[];
  legend?: string;
  maxzoom?: number;
  minzoom?: number;
  name?: string;
  scheme?: "xyz" | "tms";
  template?: string;
  version?: string;
}

async function nativeDecompress(
  buf: ArrayBuffer,
  compression: Compression
): Promise<ArrayBuffer> {
  const run = async () => {
    if (
      compression === Compression.None ||
      compression === Compression.Unknown
    ) {
      return buf;
    }
    if (compression === Compression.Gzip) {
      const stream = new Response(buf).body;
      if (!stream) {
        throw new Error("Failed to read response stream");
      }
      const result = stream.pipeThrough(new DecompressionStream("gzip"));
      return new Response(result).arrayBuffer();
    }
    throw new Error("Compression method not supported");
  };

  const timing = getTiming();
  if (!timing) {
    return run();
  }
  const start = performance.now();
  try {
    return await run();
  } finally {
    // Clock advances across the stream/arrayBuffer awaits above.
    timing.recordDecompress(performance.now() - start);
  }
}

// Headers and directories are cached across requests handled by the same
// isolate, so most tile lookups on a warm isolate need a single R2 range read.
const CACHE = new ResolvedValueCache(25, undefined, nativeDecompress);

class R2Source implements Source {
  private bucket: R2Bucket;
  private archiveName: string;

  constructor(bucket: R2Bucket, archiveName: string) {
    this.bucket = bucket;
    this.archiveName = archiveName;
  }

  getKey() {
    return this.archiveName;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string
  ): Promise<RangeResponse> {
    const timing = getTiming();
    if (
      offset === 0 &&
      length === PMTILES_PREFIX_LENGTH &&
      etag === undefined
    ) {
      return fetchArchivePrefix(this.bucket, this.archiveName, timing);
    }

    const start = performance.now();
    try {
      const resp = await this.bucket.get(`${this.archiveName}.pmtiles`, {
        range: { offset, length },
        onlyIf: { etagMatches: etag },
      });
      if (!resp) {
        throw new KeyNotFoundError("Archive not found");
      }

      const o = resp as R2ObjectBody;
      if (!o.body) {
        // Precondition failed: the archive changed since cached directories
        // were fetched. PMTiles will invalidate its cache and retry.
        throw new EtagMismatch();
      }

      return {
        data: await o.arrayBuffer(),
        etag: o.etag,
        cacheControl: o.httpMetadata?.cacheControl,
        expires: o.httpMetadata?.cacheExpiry?.toISOString(),
      };
    } finally {
      timing?.recordR2(performance.now() - start);
    }
  }
}

/**
 * Build a PMTiles reader over `name.pmtiles` in R2.
 *
 * Uses an isolate-local ResolvedValueCache for decoded headers/directories,
 * and routes the initial header/root read through PoP prefix caching.
 */
export function createPMTiles(name: string, bucket: R2Bucket): PMTiles {
  return new PMTiles(new R2Source(bucket, name), CACHE, nativeDecompress);
}
