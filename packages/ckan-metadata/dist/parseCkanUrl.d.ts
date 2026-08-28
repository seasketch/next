export interface ParsedCkanUrl {
    baseUrl: string;
    datasetId: string;
    apiRoot: string;
    locale: string | null;
    datasetPageUrl: string;
}
export declare function parseCkanUrl(input: unknown): ParsedCkanUrl | null;
export declare function localizedDatasetPageUrl(parsed: ParsedCkanUrl, requestedLocale?: string | null): string;
//# sourceMappingURL=parseCkanUrl.d.ts.map