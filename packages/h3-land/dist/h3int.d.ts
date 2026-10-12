/**
 * H3 indexes fit in the low 63 bits, so SQLite's signed INTEGER can store
 * them without a transform. `cellToInt` / `intToCell` are the raw form.
 */
export declare function cellToInt(index: string): bigint;
export declare function intToCell(value: bigint): string;
export declare function asCellInt(value: unknown): bigint;
