import { CompatibleSpatialMetricDetailsFragment } from "../../generated/graphql";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";

export interface MetricResolver {
  /**
   * Resolves a metric value based on the provided attributes.
   * @param type - The metric type (e.g., "total_area", "overlay_area")
   * @param geography - The geography ID (optional, for geography-based metrics)
   * @param style - Number format style (e.g., "decimal", "percent", "currency", "unit")
   * @param unit - Unit for unit-style formatting (e.g., "hectare", "meter")
   * @param minimumFractionDigits - Minimum fraction digits
   * @param maximumFractionDigits - Maximum fraction digits
   * @returns The resolved metric value as a string, or null if not found
   */
  resolve: (
    type: string,
    geography: string | null,
    style?: keyof Intl.NumberFormatOptionsStyleRegistry,
    unit?: string,
    minimumFractionDigits?: number,
    maximumFractionDigits?: number
  ) => string | null;
}

/**
 * Creates a metric resolver from an array of metrics.
 * The resolver can look up metric values by type and geography ID.
 * When geography is null, it sums all fragment-based metrics for the given type.
 * Values are returned as strings for direct display.
 */
export function createMetricResolver(
  metrics: CompatibleSpatialMetricDetailsFragment[]
): MetricResolver {
  return {
    resolve: (
      type: string,
      geography: string | null,
      style: keyof Intl.NumberFormatOptionsStyleRegistry = "decimal",
      unit: string | undefined = undefined,
      minimumFractionDigits: number = 0,
      maximumFractionDigits: number = 2,
      compactDisplay: "short" | "long" = "short"
    ): string | null => {
      switch (type) {
        case "total_area":
          if (geography === null) {
            let totalArea = 0;
            for (const m of metrics) {
              if (m.type === "total_area" && subjectIsFragment(m.subject)) {
                totalArea += m.value;
              }
            }
            unit = unit || "kilometer";
            if (unit !== "kilometer") {
              totalArea = convertSquareKilometersToUnit(
                totalArea,
                unit as "hectare" | "acre" | "mile"
              );
            }
            console.log(
              "resolve",
              totalArea,
              minimumFractionDigits,
              maximumFractionDigits,
              style,
              unit
            );
            let stringified = Intl.NumberFormat(undefined, {
              minimumFractionDigits,
              maximumFractionDigits,
              style: "unit",
              unit: unit,
              compactDisplay,
            }).format(totalArea);
            if (unit !== "hectare" && unit !== "acre") {
              stringified += "²";
            }
            return stringified;
          } else {
            const metric = metrics.find(
              (m) =>
                m.type === "total_area" &&
                subjectIsGeography(m.subject) &&
                m.subject.id === parseInt(geography)
            );
            if (!metric) {
              return null;
            }
            return Intl.NumberFormat(undefined, {
              minimumFractionDigits,
              maximumFractionDigits,
              style,
              unit,
            }).format(metric.value);
          }
        default:
          return null;
      }
    },
  };
}

function convertSquareKilometersToUnit(
  sqKm: number,
  unit: "hectare" | "acre" | "mile"
) {
  if (unit === "hectare") {
    return sqKm * 100;
  } else if (unit === "acre") {
    return sqKm * 247.105381;
  } else if (unit === "mile") {
    return sqKm * 0.386102;
  }
  return sqKm;
}
