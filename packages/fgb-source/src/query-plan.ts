import { FetchRangeFn } from "./fetch-manager";
import { OffsetAndLength } from "./rtree";
import {
  SIZE_PREFIX_LEN,
  VALIDATE_FEATURE_DATA,
  QUERY_PLAN_DEFAULTS,
} from "./constants";

/**
 * Represents a request to fetch a range of bytes from the source.
 */
export type QueryPlanRequest = {
  /** Byte range to fetch [start, end] */
  range: [number, number | null];
  /** Offsets of features within the range [offset, length][] */
  offsets: [number, number | null][];
};

/**
 * Options for query planning and execution.
 */
export type QueryPlanOptions = {
  /** Maximum number of bytes to overfetch when merging ranges */
  overfetchBytes?: number;
  /** Skip validation of feature data size prefixes */
  skipValidation?: boolean;
};

/**
 * Creates a query plan from search results, optimizing for minimal network requests
 * while maintaining feature order.
 */
export function createQueryPlan(
  results: OffsetAndLength[],
  featureDataOffset: number,
  options: QueryPlanOptions
): QueryPlanRequest[] {
  // Sort results by offset to maintain feature order
  results.sort((a, b) => a[0] - b[0]);

  if (results.length === 0) {
    return [];
  } else if (results.length === 1) {
    const result = results[0];
    return [
      {
        range: toRange(result, featureDataOffset),
        offsets: [[0, result[1]]],
      },
    ];
  }

  // Group results into ranges that can be fetched in a single request
  const ranges: QueryPlanRequest[] = [];
  let offset = 0;
  const [start, length] = results[0];
  let currentRange: QueryPlanRequest = {
    range: toRange([start, length], featureDataOffset),
    offsets: [[0, length!]],
  };
  offset = length!;
  ranges.push(currentRange);

  const maxRangeSize = 1024 * 1024 * 10; // 10MB max range size
  const overfetchBytes =
    options.overfetchBytes ?? QUERY_PLAN_DEFAULTS.overfetchBytes;

  for (let i = 1; i < results.length; i++) {
    const [start, length] = results[i];
    const range = toRange([start, length], featureDataOffset);
    const distance = range[0] - currentRange.range[1]! - 1;
    const mergedRangeSize = range[1]! - currentRange.range[0];

    // Merge ranges if:
    // 1. The distance between ranges is small enough
    // 2. The merged range size would be reasonable
    // 3. The total number of features in the range isn't too large
    if (
      distance < overfetchBytes &&
      mergedRangeSize < maxRangeSize &&
      currentRange.offsets.length < 100
    ) {
      // merge the ranges and add to existing request
      currentRange.range[1] = range[1];
      offset += distance;
      currentRange.offsets.push([offset, length]);
      offset += length!;
    } else {
      // add a new request
      currentRange = {
        range,
        offsets: [[0, length!]],
      };
      offset = length!;
      ranges.push(currentRange);
    }
  }

  return ranges;
}

/**
 * Convert an OffsetAndLength tuple to a byte range tuple. Accounts for
 * possible null length, which indicates the end of the file. In this case
 * the range is [start, null].
 * @param offsetAndLength
 * @returns [number, number | null]
 */
function toRange(
  offsetAndLength: OffsetAndLength,
  featureDataOffset: number
): [number, number | null] {
  if (offsetAndLength[1] === null) {
    return [featureDataOffset + offsetAndLength[0], null];
  } else {
    return [
      featureDataOffset + offsetAndLength[0],
      featureDataOffset + offsetAndLength[0] + offsetAndLength[1] - 1,
    ];
  }
}

/**
 * Execute a query plan by fetching and processing features in parallel.
 * Features are yielded as soon as they are available, rather than in the
 * order they were requested.
 */
export async function* executeQueryPlan(
  plan: QueryPlanRequest[],
  fetchRange: FetchRangeFn,
  options: QueryPlanOptions = {}
): AsyncGenerator<[globalThis.DataView, number]> {
  // Start all fetch requests in parallel and map them to their respective plan index
  const fetchPromises = plan.map(async ({ range, offsets }, i) => {
    const data = await fetchRange(range);
    return { data, offsets, i };
  });

  // Use Promise.race to yield data as soon as each fetch is ready
  const pendingFetches = new Set(plan.map((_, i) => i));

  while (pendingFetches.size > 0) {
    // Wait for the next fetch to complete
    const completedFetch = await Promise.race(
      [...pendingFetches].map((i: number) => fetchPromises[i])
    );

    // Remove the completed fetch from the pending set
    pendingFetches.delete(completedFetch.i);

    // Process the completed fetch
    const { data, offsets } = completedFetch;
    const view = new DataView(data);

    for (let [offset, length] of offsets) {
      if (length === null) {
        length = view.buffer.byteLength - offset;
      }

      const featureView = new DataView(data, offset, length);
      if (VALIDATE_FEATURE_DATA) {
        const size = featureView.getUint32(0, true);
        if (size !== length - SIZE_PREFIX_LEN) {
          throw new Error(
            `Feature data size mismatch: expected ${length}, size prefix was ${size}`
          );
        }
      }
      yield [featureView, offset];
    }
  }
}
