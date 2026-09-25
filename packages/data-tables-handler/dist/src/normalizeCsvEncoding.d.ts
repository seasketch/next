export type CsvFileEncoding = "utf-8" | "windows-1252";
/**
 * DuckDB's CSV reader requires valid UTF-8. Legacy Excel/R exports are often
 * Windows-1252 (a Latin-1 superset). DuckDB's built-in `encoding='latin-1'`
 * rejects bytes 0x80–0x9F, so non-UTF-8 files are rewritten as UTF-8 using
 * Windows-1252. Conversion is streamed; Node cannot stringify a 1GB+ buffer.
 */
export declare function detectCsvEncoding(csvPath: string): CsvFileEncoding;
export declare function normalizeCsvEncodingIfNeeded(csvPath: string, normalizedPath?: string): Promise<{
    path: string;
    normalized: boolean;
}>;
