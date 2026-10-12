import { type PackStats } from "./format";
/**
 * Pack a finalized raw occupancy database into the fixed-stride archive.
 * Cells are read as two 32-bit halves because Node 22.16 cannot return an
 * H3 index as a JavaScript number. Uniform land parents are counted on the
 * first pass and omitted from the second, so a resolution-9 table does not
 * have to keep every interior cell in memory.
 */
export declare function packDatabase(input: string, output: string): PackStats;
