export const VERSION = 3;

/**
 * Magic bytes that identify a FlatGeobuf file.
 * These bytes must appear at the start of a valid FlatGeobuf file.
 */
export const MAGIC_BYTES = [0x66, 0x67, 0x62, VERSION, 0x66, 0x67, 0x62, 0]; // "fgb\0"

/**
 * Size of the length prefix for each feature in bytes.
 * Each feature in a FlatGeobuf file is prefixed with a 4-byte length.
 */
export const SIZE_PREFIX_LEN = 4;

/**
 * Default size to fetch when reading the header.
 */
export const HEADER_FETCH_SIZE = 8192 * 4;

/**
 * Default options for query planning.
 */
export const QUERY_PLAN_DEFAULTS = {
  /**
   * Amount of space allowed between features before splitting requests.
   * If features are closer together than this, they will be fetched in a
   * single request to minimize network overhead.
   */
  overfetchBytes: 500 * 1024, // 500KB
} as const;

/**
 * Default size of the feature data cache in bytes.
 * This can be overridden when creating a source.
 */
export const DEFAULT_CACHE_SIZE = 16 * 1024 * 1024; // 16MB

/**
 * Whether to validate feature data size prefixes against actual sizes.
 * This is useful for debugging but should be disabled in production.
 */
export const VALIDATE_FEATURE_DATA = true;

/**
 * Default page size for paged range fetching and caching.
 */
export const PAGE_SIZE = 5 * 1024 * 1024; // 5MB
