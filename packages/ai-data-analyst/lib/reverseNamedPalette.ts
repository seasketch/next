/**
 * Whether to reverse a named d3 palette for styling. The model may only suggest
 * reversal with a non-empty `palette` and without a meaningful `custom_palette`.
 */
export function effectiveReverseNamedPalette(
  notes:
    | {
        palette?: string | null;
        custom_palette?: Record<string, string> | string | null;
        reverse_palette?: boolean;
      }
    | null
    | undefined,
): boolean {
  if (!notes?.reverse_palette) {
    return false;
  }
  const named =
    typeof notes.palette === "string" && notes.palette.trim().length > 0;
  if (!named) {
    return false;
  }
  const cp = notes.custom_palette;
  const hasCustom =
    cp != null &&
    (typeof cp === "string"
      ? cp.trim().length > 0
      : typeof cp === "object" &&
        !Array.isArray(cp) &&
        Object.keys(cp as Record<string, string>).length > 0);
  return !hasCustom;
}
