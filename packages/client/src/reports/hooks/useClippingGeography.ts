import { useMemo } from "react";
import {
  GeographyDetailsFragment,
  ReportContextSketchClassDetailsFragment,
} from "../../generated/graphql";
import { useSubjectReportContext } from "../context/SubjectReportContext";

/**
 * Returns the geography that the subject sketch was clipped to, with its id
 * and name. Handles the case of multiple clipping geographies if configured.
 *
 */
export function useClippingGeography(
  sketchClass: Pick<
    ReportContextSketchClassDetailsFragment,
    "clippingGeographies"
  >,
  geographies: Pick<GeographyDetailsFragment, "id" | "name">[]
): Pick<GeographyDetailsFragment, "id" | "name"> | undefined {
  const { data } = useSubjectReportContext();

  return useMemo(() => {
    const clippingGeos =
      sketchClass?.clippingGeographies?.filter(Boolean) ?? [];

    if (clippingGeos.length === 0) return undefined;

    if (clippingGeos.length === 1) {
      const clippingGeography = clippingGeos[0]!;
      return geographies.find((g) => g.id === clippingGeography.id);
    } else {
      const clippingIds = new Set(clippingGeos.map((g) => g!.id));
      if (data?.relatedFragments) {
        for (const fragment of data.relatedFragments) {
          for (const geoId of fragment.geographies) {
            if (clippingIds.has(geoId)) {
              return geographies.find((g) => g.id === geoId);
            }
          }
        }
      }
    }
    return undefined;
  }, [sketchClass?.clippingGeographies, geographies, data?.relatedFragments]);
}
