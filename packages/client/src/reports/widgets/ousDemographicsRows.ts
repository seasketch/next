import {
  OUS_DEMOGRAPHICS_ROLLUP_KEY,
  OusDemographicsMetricValue,
  summarizeOusDemographicsValue,
} from "overlay-engine";

export type OusDemographicsTotalMode = "representedInSector" | "participants";

/**
 * Where the Total column's people count comes from.
 *
 * - `dataset`: every respondent in the survey layer (`value.totals`).
 * - `geography`: respondents whose shapes overlap the clipping geography.
 *   That set is `groups` on the geography-subject metric. `totals` on that
 *   metric is still the full dataset and must not be used here.
 */
export type OusDemographicsTotalScope = "dataset" | "geography";

/**
 * A fragment metric belongs to the denominator geography when that geography
 * id is on `subject.geographies`. Pieces of the plan that only overlap other
 * geographies stay out of the within-plan count.
 */
export function ousFragmentBelongsToGeography(
  subject: unknown,
  geographyId: number
): boolean {
  if (subject == null || typeof subject !== "object") {
    return false;
  }
  if (!("geographies" in subject)) {
    return false;
  }
  const geographies = subject.geographies;
  return Array.isArray(geographies) && geographies.includes(geographyId);
}

/**
 * Total-column population for a saved widget.
 *
 * An explicit `dataset` or `geography` choice is kept. When the card never
 * set `totalScope`, the Total column uses the clipping geography. Sketch
 * classes that do not clip keep the entire-survey total, which is the only
 * population those tables can count.
 */
export function resolveOusDemographicsTotalScope(
  totalScope: OusDemographicsTotalScope | undefined,
  hasClippingGeography: boolean
): OusDemographicsTotalScope {
  if (totalScope === "dataset" || totalScope === "geography") {
    return totalScope;
  }
  return hasClippingGeography ? "geography" : "dataset";
}

export type OusDemographicsFigure = {
  key: string;
  within: number;
  total: number;
};

/**
 * Within-plan counts always come from fragment metrics. The Total column
 * uses either dataset-wide totals or the summarized geography-overlap groups.
 */
export function buildOusDemographicsFigures(opts: {
  fragmentValue: OusDemographicsMetricValue;
  geographyValue?: OusDemographicsMetricValue | null;
  totalScope: OusDemographicsTotalScope;
  totalMode: OusDemographicsTotalMode;
}): { groups: OusDemographicsFigure[]; rollup?: OusDemographicsFigure } {
  const withinSummaries = summarizeOusDemographicsValue(opts.fragmentValue);
  const useGeography = opts.totalScope === "geography";
  const geographySummaries = useGeography
    ? summarizeOusDemographicsValue(opts.geographyValue)
    : undefined;

  const keys = new Set<string>();
  if (useGeography) {
    for (const key of Object.keys(geographySummaries || {})) {
      if (key !== OUS_DEMOGRAPHICS_ROLLUP_KEY) {
        keys.add(key);
      }
    }
    // A within-plan group missing from the geography metric (boundary
    // simplification) should still be visible, with a zero total.
    for (const key of Object.keys(withinSummaries)) {
      if (
        key !== OUS_DEMOGRAPHICS_ROLLUP_KEY &&
        (withinSummaries[key]?.representedInSector ?? 0) > 0
      ) {
        keys.add(key);
      }
    }
  } else {
    for (const key of Object.keys(opts.fragmentValue.totals || {})) {
      if (key !== OUS_DEMOGRAPHICS_ROLLUP_KEY) {
        keys.add(key);
      }
    }
  }

  const totalFor = (key: string): number => {
    if (useGeography) {
      const value = geographySummaries?.[key]?.[opts.totalMode];
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    }
    const value = opts.fragmentValue.totals?.[key]?.[opts.totalMode];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };

  const withinFor = (key: string): number =>
    withinSummaries[key]?.representedInSector ?? 0;

  const groups = [...keys].map((key) => ({
    key,
    within: withinFor(key),
    total: totalFor(key),
  }));

  const rollupSource = useGeography
    ? geographySummaries
    : opts.fragmentValue.totals;
  const rollup =
    rollupSource && OUS_DEMOGRAPHICS_ROLLUP_KEY in rollupSource
      ? {
          key: OUS_DEMOGRAPHICS_ROLLUP_KEY,
          within: withinFor(OUS_DEMOGRAPHICS_ROLLUP_KEY),
          total: totalFor(OUS_DEMOGRAPHICS_ROLLUP_KEY),
        }
      : undefined;

  return { groups, rollup };
}
