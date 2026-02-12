import bbox from "@turf/bbox";
import { BBox } from "geojson";
import { CameraOptions } from "mapbox-gl";
import { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  MapManagerContext,
  useMapContext,
} from "../../dataLayers/MapContextManager";
import {
  BasemapDetailsFragment,
  useGetBasemapsAndRegionQuery,
} from "../../generated/graphql";
import { normalizeStyleUrl } from "../../offline/mapboxApiHelpers";
import { MAP_STATIC_ASSETS_CACHE_NAME } from "../../offline/MapTileCache";
import { OfflineStateContext } from "../../offline/OfflineStateContext";
import useDebounce from "../../useDebounce";

export const defaultStartingBounds = [
  -119.91579655058345, 33.87415760617607, -119.24033098014716, 34.2380902987356,
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
  const {
    managerState,
    sketchLayerState,
    basemapState,
    legendsState,
    mapOverlayState,
  } = useMapContext({
    camera: cameraOptions,
    bounds,
  });
  const { manager } = managerState;
  const [basemaps, setBasemaps] = useState<BasemapDetailsFragment[]>([]);
  bounds =
    bounds ||
    (data?.projectBySlug?.region.geojson
      ? bbox(data.projectBySlug.region.geojson)
      : defaultStartingBounds) ||
    defaultStartingBounds;

  const debouncedCamera = useDebounce(cameraOptions, 30);
  const { online } = useContext(OfflineStateContext);
  const basemapsString = data?.projectBySlug?.basemaps?.join(",");
  const surveyBasemapsString = data?.projectBySlug?.surveyBasemaps?.join(",");
  const filterBasemapIdsString = filterBasemapIds?.join(",");
  useEffect(
    () => {
      if (manager && data?.projectBySlug?.basemaps) {
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
        if (!online) {
          // need to first check that basemaps are cached
          caches.open(MAP_STATIC_ASSETS_CACHE_NAME).then(async (cache) => {
            const offlineBasemaps: BasemapDetailsFragment[] = [];
            for (const basemap of basemaps) {
              const cacheKey = new URL(normalizeStyleUrl(basemap.url, ""));
              cacheKey.searchParams.delete("access_token");
              const match = await cache.match(cacheKey.toString());
              if (Boolean(match)) {
                offlineBasemaps.push(basemap);
              }
            }
            setBasemaps(offlineBasemaps.length ? offlineBasemaps : basemaps);
            manager?.setBasemaps(
              offlineBasemaps.length ? offlineBasemaps : basemaps
            );
          });
        } else {
          setBasemaps(basemaps);
          manager?.setBasemaps(basemaps);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      basemapsString,
      surveyBasemapsString,
      manager,
      filterBasemapIdsString,
      online,
    ]
  );

  useEffect(() => {
    if (manager?.map && debouncedCamera) {
      const map = manager.map;
      map.flyTo({
        ...debouncedCamera,
      });
    }
  }, [debouncedCamera, manager?.map]);

  return {
    basemaps,
    managerState,
    sketchLayerState,
    basemapState,
    legendsState,
    mapOverlayState,
    bounds,
    cameraOptions,
  };
}
