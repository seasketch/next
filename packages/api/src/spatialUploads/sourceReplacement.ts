/**
 * Admin-authored data_sources / data_layers fields that must survive a
 * replacement upload. File-derived fields (url, geostats, bounds, type,
 * zoom) come from the new ingest and are not copied.
 */

export type AdminAuthoredSourceFields = {
  attribution: string | null;
  temporal: unknown;
  translated_props: unknown;
};

/**
 * Hosted-source columns admins set in the layer editor. Attribution is
 * copied when the old source has a value (including empty string); ingest
 * AI/geostats attribution is used only when the old source never had one.
 * Temporal and translated_props are always taken from the old source.
 */
export function adminAuthoredSourceFieldsFrom(
  oldSource: Partial<AdminAuthoredSourceFields> | null | undefined,
): AdminAuthoredSourceFields {
  return {
    attribution: oldSource?.attribution ?? null,
    temporal: oldSource?.temporal ?? null,
    translated_props: oldSource?.translated_props ?? {},
  };
}

export function attributionForNewSource(opts: {
  oldAttribution: string | null | undefined;
  conversionAttribution?: string | null;
  aiAttribution?: string | null;
  geostatsAttribution?: string | null;
}): string | null {
  if (opts.oldAttribution != null) {
    return opts.oldAttribution;
  }
  if (opts.conversionAttribution) {
    return opts.conversionAttribution;
  }
  if (opts.aiAttribution !== undefined) {
    return opts.aiAttribution;
  }
  return opts.geostatsAttribution ?? null;
}

/**
 * True when the existing layer already has cartography that a replacement
 * must keep. Null, empty array, and JSON-null strings count as "no style"
 * (e.g. ArcGIS → hosted, where we still need to generate one).
 */
export function layerHasMapboxGlStyles(styles: unknown): boolean {
  if (styles == null) {
    return false;
  }
  if (Array.isArray(styles)) {
    return styles.length > 0;
  }
  if (typeof styles === "string") {
    const trimmed = styles.trim();
    if (trimmed === "" || trimmed === "[]" || trimmed === "null") {
      return false;
    }
    return true;
  }
  return true;
}
