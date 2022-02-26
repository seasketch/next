import bbox from "@turf/bbox";
import { BBox } from "geojson";
import {
  CameraOptions,
  FreeCameraOptions,
  LngLatBoundsLike,
  Map,
} from "mapbox-gl";
import { useEffect, useState } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useMapContext } from "../../dataLayers/MapContextManager";
import {
  BasemapDetailsFragment,
  useGetBasemapsAndRegionQuery,
} from "../../generated/graphql";
import useDebounce from "../../useDebounce";

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
  const mapContext = useMapContext({ camera: cameraOptions, bounds });
  const [basemaps, setBasemaps] = useState<BasemapDetailsFragment[]>([]);
  bounds =
    bounds ||
    (data?.currentProject?.region.geojson
      ? bbox(data.currentProject.region.geojson)
      : defaultStartingBounds) ||
    defaultStartingBounds;

  const debouncedCamera = useDebounce(cameraOptions, 30);

  useEffect(() => {
    if (mapContext?.manager && data?.currentProject?.basemaps?.length) {
      let basemaps: BasemapDetailsFragment[] = [];
      if (filterBasemapIds) {
        basemaps = filterBasemapIds
          .map((id) =>
            (data.currentProject?.basemaps || []).find((b) => b.id === id)
          )
          .filter((b) => b !== undefined) as BasemapDetailsFragment[];
      } else {
        basemaps = data.currentProject.basemaps;
      }
      if (!basemaps.length) {
        basemaps = [data.currentProject.basemaps[0]];
      }
      setBasemaps(basemaps);
      // mapContext.manager.setProjectBounds(bboxPolygon(bounds));
      mapContext.manager?.setBasemaps(basemaps);
    }
  }, [data?.currentProject?.basemaps, mapContext.manager, filterBasemapIds]);

  useEffect(() => {
    if (mapContext?.manager?.map && debouncedCamera) {
      const map = mapContext.manager.map;
      map.flyTo({
        ...debouncedCamera,
      });
    }
  }, [debouncedCamera]);

  return { basemaps, mapContext, bounds, cameraOptions };
}
