import { useMemo } from "react";
import {
  GeographyDetailsFragment,
  Geography,
  ReportContextSketchClassDetailsFragment,
  SketchGeometryType,
} from "../../generated/graphql";
import { useClippingGeography } from "./useClippingGeography";

/** Sketch class subset used to resolve clipping geographies for collection reports. */
type PolygonalChildSketchClass = {
  id: number;
  geometryType: SketchGeometryType;
  isArchived: boolean;
  clippingGeographies: Array<Pick<Geography, "id"> | null | undefined>;
};

export type SketchClassPrimaryGeoFields = {
  geometryType: SketchGeometryType;
  clippingGeographies: PolygonalChildSketchClass["clippingGeographies"];
  validChildren?: PolygonalChildSketchClass[] | null;
  project?: {
    sketchClasses?: PolygonalChildSketchClass[];
  } | null;
};

/**
 * For collection sketch classes, the sketch class itself has no clipping
 * geometry. Reporting uses the first polygonal (non-archived) sketch class that
 * can appear in the collection — preferring `validChildren` when configured,
 * otherwise scanning `project.sketchClasses` — that has at least one clipping
 * geography. Order: ascending by sketch class id.
 */
export function resolvePrimaryClippingGeographies(
  sketchClass: SketchClassPrimaryGeoFields
): SketchClassPrimaryGeoFields["clippingGeographies"] {
  if (sketchClass.geometryType !== SketchGeometryType.Collection) {
    return sketchClass.clippingGeographies;
  }

  const allowed = sketchClass.validChildren?.filter(Boolean) ?? [];
  const candidates =
    allowed.length > 0
      ? allowed
      : sketchClass.project?.sketchClasses?.filter(Boolean) ?? [];

  const sorted = [...candidates].sort((a, b) => a.id - b.id);

  const reference = sorted.find(
    (c) =>
      !c.isArchived &&
      c.geometryType === SketchGeometryType.Polygon &&
      (c.clippingGeographies?.filter(Boolean)?.length ?? 0) > 0
  );

  if (!reference) {
    return sketchClass.clippingGeographies;
  }

  return reference.clippingGeographies;
}

/**
 * Resolves the "primary" reporting geography for the current report subject:
 * the sketch class's clipping geography when the report is for a polygon
 * class, or the clipping geography derived from {@link resolvePrimaryClippingGeographies}
 * for collection classes. Uses the same related-fragment disambiguation as
 * {@link useClippingGeography}.
 */
export function usePrimaryGeography(
  sketchClass: SketchClassPrimaryGeoFields,
  geographies: Pick<GeographyDetailsFragment, "id" | "name">[]
): {
  clippingGeography: Pick<GeographyDetailsFragment, "id" | "name"> | undefined;
  /** Clipping geography id list after collection → polygon-class resolution. */
  primaryClippingGeographies: SketchClassPrimaryGeoFields["clippingGeographies"];
} {
  const primaryClippingGeographies = useMemo(
    () => resolvePrimaryClippingGeographies(sketchClass),
    [sketchClass]
  );

  const clippingGeography = useClippingGeography(
    {
      clippingGeographies:
        primaryClippingGeographies as ReportContextSketchClassDetailsFragment["clippingGeographies"],
    },
    geographies
  );

  return { clippingGeography, primaryClippingGeographies };
}
