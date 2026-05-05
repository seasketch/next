import { SketchGeometryType } from "../../../generated/graphql";
import type { Geography } from "../../../generated/graphql";
import type { SketchClassForExport, RelatedFragmentLike } from "./types";
import { resolvePrimaryClippingGeographies } from "../../hooks/usePrimaryGeography";

type GeoPick = Pick<Geography, "id" | "name">;

/**
 * Pure equivalent of useClippingGeography for export code (no hooks).
 */
export function resolveClippingGeographyForExport(
  sketchClass: SketchClassForExport,
  geographies: GeoPick[],
  relatedFragments: RelatedFragmentLike[],
): GeoPick | undefined {
  const primaryClipping = resolvePrimaryClippingGeographies(sketchClass);
  const clippingGeos = primaryClipping?.filter(Boolean) ?? [];
  if (clippingGeos.length === 0) return undefined;
  if (clippingGeos.length === 1) {
    return geographies.find((g) => g.id === clippingGeos[0]!.id);
  }
  const clippingIds = new Set(clippingGeos.map((g) => g!.id));
  for (const fragment of relatedFragments) {
    for (const geoId of fragment.geographies) {
      if (clippingIds.has(geoId)) {
        return geographies.find((g) => g.id === geoId);
      }
    }
  }
  return undefined;
}

export function isCollectionSketchClass(
  sketchClass: SketchClassForExport,
): boolean {
  return sketchClass.geometryType === SketchGeometryType.Collection;
}
