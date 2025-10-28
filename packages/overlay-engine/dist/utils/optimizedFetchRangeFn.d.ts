export declare function makeFetchRangeFn(rootUrl: string, maxCacheSizeBytes?: number): {
    fetchRangeFn: (url: string, range: [number, number | null]) => Promise<ArrayBuffer>;
    cacheHits: number;
    cacheMisses: number;
};
//# sourceMappingURL=optimizedFetchRangeFn.d.ts.map