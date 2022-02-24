import bbox from "@turf/bbox";
import { BBox } from "geojson";
import { CameraOptions, LngLatBoundsLike, Map } from "mapbox-gl";
import { useEffect, useState } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useMapContext } from "../../dataLayers/MapContextManager";
import {
  BasemapDetailsFragment,
  useGetBasemapsAndRegionQuery,
} from "../../generated/graphql";

export const defaultStartingBounds = [
  -119.91579655058345,
  33.87415760617607,
  -119.24033098014716,
  34.2380902987356,
] as BBox;

/**
 * Sets up a map with basemaps, starting bounds, and a mapContext. Using for
 * surveys now but may be more widely useful
 */
export default function useMapEssentials({
  bounds,
  filterBasemapIds,
  cameraOptions,
}: {
  /** Starting bounds of the map. If not provided will default to project region */
  bounds?: BBox;
  /** Limit basemaps to those with the provided IDs */
  filterBasemapIds?: number[];
  /** Will take priority over bounds if set */
  cameraOptions?: CameraOptions;
}) {
  const onError = useGlobalErrorHandler();
  const { data } = useGetBasemapsAndRegionQuery({ onError });
  const mapContext = useMapContext();
  const [basemaps, setBasemaps] = useState<BasemapDetailsFragment[]>([]);
  bounds =
    bounds ||
    (data?.currentProject?.region.geojson
      ? bbox(data.currentProject.region.geojson)
      : defaultStartingBounds) ||
    defaultStartingBounds;

  useEffect(() => {
    if (mapContext?.manager && data?.currentProject?.basemaps?.length) {
      let basemaps: BasemapDetailsFragment[] = [];
      basemaps = data.currentProject.basemaps.filter(
        (b) => !filterBasemapIds || filterBasemapIds.indexOf(b.id) !== -1
      );
      if (!basemaps.length) {
        basemaps = [data.currentProject.basemaps[0]];
      }
      setBasemaps(basemaps);
      // mapContext.manager.setProjectBounds(bboxPolygon(bounds));
      mapContext.manager?.setBasemaps(basemaps);
      // TODO: This is a pretty shitty way to do this. MapContextManager needs
      // to be modified a bit to account for these simpler use-cases that aren't
      // so bound to project-wide settings
      setTimeout(() => {
        if (mapContext?.manager?.map) {
          mapContext!.manager!.map!.fitBounds(bounds as LngLatBoundsLike, {
            animate: false,
            padding: 2,
          });
        }
      }, 200);
    }
  }, [data?.currentProject?.basemaps, mapContext.manager, filterBasemapIds]);

  return { basemaps, mapContext, bounds };
}
