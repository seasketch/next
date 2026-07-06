/**
 * DuckDB's CSV reader requires valid UTF-8. Many legacy exports (Excel, R, etc.)
 * are Latin-1 / Windows-1252. Reinterpret single-byte encodings as Latin-1 and
 * write UTF-8 so every byte 0x00–0xFF round-trips without parse failures.
 */
export declare function normalizeCsvEncodingIfNeeded(csvPath: string, normalizedPath?: string): {
    path: string;
    normalized: boolean;
};
