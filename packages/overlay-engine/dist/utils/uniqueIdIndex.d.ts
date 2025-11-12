import { UniqueIdIndex } from "../metrics/metrics";
/**
 * Creates a UniqueIdIndex from an unsorted array or Set of IDs.
 * Removes duplicates, sorts, and groups consecutive IDs into ranges.
 * IDs that don't fit into ranges are stored as individuals.
 *
 * @param ids - Array or Set of numeric IDs (may contain duplicates)
 * @returns A UniqueIdIndex with sorted ranges and individuals
 */
export declare function createUniqueIdIndex(ids: number[] | Set<number>): UniqueIdIndex;
/**
 * Counts the total number of unique IDs represented by a UniqueIdIndex.
 *
 * @param index - The UniqueIdIndex to count
 * @returns The total count of unique IDs
 */
export declare function countUniqueIds(index: UniqueIdIndex): number;
/**
 * Merges multiple UniqueIdIndexes into a single one, removing duplicates
 * and combining adjacent/overlapping ranges.
 *
 * @param indexes - One or more UniqueIdIndexes to merge
 * @returns A merged UniqueIdIndex
 */
export declare function mergeUniqueIdIndexes(...indexes: UniqueIdIndex[]): UniqueIdIndex;
//# sourceMappingURL=uniqueIdIndex.d.ts.map