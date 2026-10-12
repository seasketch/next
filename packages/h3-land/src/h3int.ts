/**
 * H3 indexes fit in the low 63 bits, so SQLite's signed INTEGER can store
 * them without a transform. `cellToInt` / `intToCell` are the raw form.
 */
export function cellToInt(index: string): bigint {
  return BigInt(`0x${index}`);
}

export function intToCell(value: bigint): string {
  return value.toString(16).padStart(15, "0");
}

export function asCellInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  throw new Error("expected an H3 integer column");
}
