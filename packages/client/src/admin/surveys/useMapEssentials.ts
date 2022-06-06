import bbox from "@turf/bbox";
import { BBox } from "geojson";
import {
  CameraOptions,
  FreeCameraOptions,
  LngLatBoundsLike,
  Map,
} from "mapbox-gl";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
  const { slug } = useParams<{ slug: string }>();
  const onError = useGlobalErrorHandler();
  const { data } = useGetBasemapsAndRegionQuery({
    onError,
    variables: {
      slug,
    },
  });
  const mapContext = useMapContext({ camera: cameraOptions, bounds });
  const [basemaps, setBasemaps] = useState<BasemapDetailsFragment[]>([]);
  bounds =
    bounds ||
    (data?.projectBySlug?.region.geojson
      ? bbox(data.projectBySlug.region.geojson)
      : defaultStartingBounds) ||
    defaultStartingBounds;

  const debouncedCamera = useDebounce(cameraOptions, 30);

  useEffect(() => {
    if (mapContext?.manager && data?.projectBySlug?.basemaps) {
      let basemaps: BasemapDetailsFragment[] = [];
      const allBasemaps = [
        ...(data.projectBySlug.basemaps || []),
        ...(data.projectBySlug.surveyBasemaps || []),
      ];
      if (filterBasemapIds && filterBasemapIds.length) {
        basemaps = filterBasemapIds
          .map((id) => allBasemaps.find((b) => b.id === id))
          .filter((b) => b !== undefined) as BasemapDetailsFragment[];
      } else {
        basemaps = allBasemaps;
      }
      if (!basemaps.length && data.projectBySlug.basemaps.length) {
        basemaps = [data.projectBySlug.basemaps[0]];
      }
      setBasemaps(basemaps);
      mapContext.manager?.setBasemaps(basemaps);
    }
  }, [
    data?.projectBySlug?.basemaps,
    data?.projectBySlug?.surveyBasemaps,
    mapContext.manager,
    filterBasemapIds,
  ]);

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
