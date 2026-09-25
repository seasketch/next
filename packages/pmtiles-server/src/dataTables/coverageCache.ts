/**
 * Survey coverage sidecar. Loaded from `{tablePath}/coverage.json` and
 * cached in isolate memory by object etag, same pattern as the organism index.
 */
import {
  buildCoverageIndex,
  isDataTableCoverage,
  type CoverageIndex,
  type DataTableCoverageRecord,
} from "@seasketch/geostats-types";

type CachedCoverage = {
  etag: string;
  index: CoverageIndex;
  records: DataTableCoverageRecord[];
};

const cache = new Map<string, CachedCoverage>();
const MAX_COVERAGE_CACHE = 40;

export function resetCoverageCache() {
  cache.clear();
}

type CoverageBucket = {
  head: (key: string) => Promise<{ etag: string } | null>;
  get: (key: string) => Promise<{ text: string; etag: string } | null>;
};

export async function loadCoverageFile(
  bucket: CoverageBucket,
  tablePath: string,
  subjectColumn: string
): Promise<CachedCoverage | null> {
  const key = `${tablePath}/coverage.json`;
  const head = await bucket.head(key);
  if (!head) return null;
  const cached = cache.get(tablePath);
  if (cached && cached.etag === head.etag && cached.index.subjectColumn === subjectColumn) {
    return cached;
  }
  const object = await bucket.get(key);
  if (!object) return null;
  const parsed = JSON.parse(object.text) as unknown;
  if (!isDataTableCoverage(parsed)) {
    throw new Error("coverage.json is not a valid coverage file.");
  }
  const entry: CachedCoverage = {
    etag: object.etag,
    index: buildCoverageIndex(parsed, subjectColumn),
    records: parsed,
  };
  if (cache.size >= MAX_COVERAGE_CACHE && !cache.has(tablePath)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(tablePath, entry);
  return entry;
}

export function r2CoverageBucket(bucket: {
  head: (key: string) => Promise<{ httpEtag?: string; etag?: string } | null>;
  get: (key: string) => Promise<{
    text: () => Promise<string>;
    httpEtag?: string;
    etag?: string;
  } | null>;
}): CoverageBucket {
  return {
    async head(key) {
      const head = await bucket.head(key);
      if (!head) return null;
      const etag = head.httpEtag || head.etag;
      return etag ? { etag } : null;
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      const etag = object.httpEtag || object.etag || key;
      return { text: await object.text(), etag };
    },
  };
}
