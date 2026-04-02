/**
 * Whether to reverse a named d3 palette for styling. The model may only suggest
 * reversal with a non-empty `palette` and without a meaningful `custom_palette`.
 */
export declare function effectiveReverseNamedPalette(notes: {
    palette?: string | null;
    custom_palette?: Record<string, string> | string | null;
    reverse_palette?: boolean;
} | null | undefined): boolean;
//# sourceMappingURL=reverseNamedPalette.d.ts.map