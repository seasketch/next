import { Bucket } from "@seasketch/geostats-types";
export declare function equalIntervalBuckets(data: number[], numBuckets: number, max?: number, fraction?: boolean): Bucket[];
export declare function quantileBuckets(data: number[], numBuckets: number, min?: number, max?: number, fraction?: boolean, includeDuplicates?: boolean): Bucket[] | null | undefined;
export declare function stdDevBuckets(data: number[], numBuckets: number, mean: number, stdDev: number, min?: number, max?: number, fraction?: boolean): Bucket[] | undefined;
export declare function naturalBreaksBuckets(data: number[], numBuckets: number, 
/** Number of unique values in data */
uniqueCount: number, min?: number, max?: number, downsampleTo?: number, fraction?: boolean): Bucket[] | null;
export declare function geometricIntervalBuckets(data: number[], numBuckets: number, min?: number, max?: number, fraction?: boolean): Bucket[];
export declare function getRepresentativeColors(pixels: number[][], numColors: number, downsampleTo?: number): [number, number, number][];
//# sourceMappingURL=stats.d.ts.map