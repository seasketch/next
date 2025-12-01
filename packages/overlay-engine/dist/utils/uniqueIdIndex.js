"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUniqueIdIndex = createUniqueIdIndex;
exports.countUniqueIds = countUniqueIds;
exports.mergeUniqueIdIndexes = mergeUniqueIdIndexes;
/**
 * Creates a UniqueIdIndex from an unsorted array or Set of IDs.
 * Removes duplicates, sorts, and groups consecutive IDs into ranges.
 * IDs that don't fit into ranges are stored as individuals.
 *
 * @param ids - Array or Set of numeric IDs (may contain duplicates)
 * @returns A UniqueIdIndex with sorted ranges and individuals
 */
function createUniqueIdIndex(ids) {
    // Convert to array and remove duplicates
    const uniqueIds = Array.from(new Set(ids));
    // Sort numerically
    uniqueIds.sort((a, b) => a - b);
    if (uniqueIds.length === 0) {
        return { ranges: [], individuals: [] };
    }
    const ranges = [];
    const individuals = [];
    let rangeStart = uniqueIds[0];
    let rangeEnd = uniqueIds[0];
    for (let i = 1; i < uniqueIds.length; i++) {
        const currentId = uniqueIds[i];
        // Check if current ID is consecutive (adjacent to rangeEnd)
        if (currentId === rangeEnd + 1) {
            // Extend the current range
            rangeEnd = currentId;
        }
        else {
            // Current range is complete
            // If range has more than 1 ID, store as range; otherwise as individual
            if (rangeStart === rangeEnd) {
                individuals.push(rangeStart);
            }
            else {
                ranges.push([rangeStart, rangeEnd]);
            }
            // Start a new range
            rangeStart = currentId;
            rangeEnd = currentId;
        }
    }
    // Don't forget the last range/individual
    if (rangeStart === rangeEnd) {
        individuals.push(rangeStart);
    }
    else {
        ranges.push([rangeStart, rangeEnd]);
    }
    return { ranges, individuals };
}
/**
 * Counts the total number of unique IDs represented by a UniqueIdIndex.
 *
 * @param index - The UniqueIdIndex to count
 * @returns The total count of unique IDs
 */
function countUniqueIds(index) {
    // Sum up counts from ranges: (end - start + 1) for each range
    const rangeCount = index.ranges.reduce((sum, [start, end]) => {
        return sum + (end - start + 1);
    }, 0);
    // Add count of individuals
    const individualCount = index.individuals.length;
    return rangeCount + individualCount;
}
/**
 * Merges multiple UniqueIdIndexes into a single one, removing duplicates
 * and combining adjacent/overlapping ranges.
 *
 * @param indexes - One or more UniqueIdIndexes to merge
 * @returns A merged UniqueIdIndex
 */
function mergeUniqueIdIndexes(...indexes) {
    if (indexes.length === 0) {
        return { ranges: [], individuals: [] };
    }
    if (indexes.length === 1) {
        return indexes[0];
    }
    // Collect all IDs from ranges and individuals
    const allIds = new Set();
    for (const index of indexes) {
        // Add IDs from ranges
        for (const [start, end] of index.ranges) {
            for (let id = start; id <= end; id++) {
                allIds.add(id);
            }
        }
        // Add individuals
        for (const id of index.individuals) {
            allIds.add(id);
        }
    }
    // Create a new index from the combined set of IDs
    // This will automatically merge ranges and convert individuals to ranges where appropriate
    return createUniqueIdIndex(allIds);
}
//# sourceMappingURL=uniqueIdIndex.js.map