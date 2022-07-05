import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import InputBlock from "../components/InputBlock";
import {
  OfflineTileSettingsFragment,
  useBasemapOfflineSettingsQuery,
  useUpdateBasemapOfflineTileSettingsMutation,
} from "../generated/graphql";
import tilebelt from "@mapbox/tilebelt";
import {
  BBox,
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import Spinner from "../components/Spinner";
import MapContextManager, { MapContext } from "../dataLayers/MapContextManager";
import { MapboxEvent, MapWheelEvent } from "mapbox-gl";
import debounce from "lodash.debounce";
import splitGeojson from "geojson-antimeridian-cut";
import { cleanCoords } from "../workers/utils";
import {
  MapTileCache,
  OfflineTileCacheStatus,
  OfflineTileSettings,
} from "./MapTileCache";
import bytes from "bytes";
import getSlug from "../getSlug";
import Switch from "../components/Switch";
import { useDebouncedFn } from "beautiful-react-hooks";
import RadioGroup from "../components/RadioGroup";
import { useMapboxStyle } from "../useMapboxStyle";
import { useStyleSources } from "./mapboxApiHelpers";
import Badge from "../components/Badge";

let worker: any;
let Calculator: MapTileCache;
if (process.env.NODE_ENV === "test") {
  worker = { getChildTiles: () => 0 };
} else {
  import("../workers/index").then((mod) => {
    worker = new mod.default();
    Calculator = worker.mapTileCache as MapTileCache;
  });
}

function addTileLayers(
  manager: MapContextManager,
  region: Feature<Polygon>,
  data?: {
    polygons: FeatureCollection<Polygon>;
    points: FeatureCollection<Point>;
  }
) {
  manager.addSource("project-region", {
    type: "geojson",
    data: region,
  });

  manager.addSource("tile-corners", {
    type: "geojson",
    data: data?.points || {
      type: "FeatureCollection",
      features: [],
    },
  });

  manager.addSource("tile-bounds", {
    type: "geojson",
    data: data?.polygons || {
      type: "FeatureCollection",
      features: [],
    },
  });

  manager.addLayer({
    id: "tile-outlines",
    type: "line",
    source: "tile-bounds",
    paint: {
      "line-color": "#000000",
      "line-opacity": 0.2,
      "line-width": 0.5,
    },
  });
  manager.addLayer({
    id: "tile-corner-text",
    type: "symbol",
    source: "tile-corners",
    paint: {
      "text-color": "#000000",
      "text-opacity": 0.8,
    },
    layout: {
      "symbol-placement": "point",
      "symbol-sort-key": ["*", ["get", "z"], -1],
      // "symbol-spacing": 900,
      "text-offset": [0.25, 0.25],
      "text-anchor": "top-left",
      "text-size": 10,
      "text-field": ["format", ["get", "z"]],
    },
  });

  manager.addLayer({
    id: "project-region-outline",
    type: "line",
    source: "project-region",
    paint: {
      "line-color": "orange",
      "line-width": 3,
    },
  });
}

type Settings = {
  maxZ: number;
  maxShorelineZ?: number;
  projectRegion?: Feature<Polygon | MultiPolygon>;
  detailedShoreline: boolean;
  useDefault: boolean;
};

export default function BasemapOfflineSettings({
  basemapId,
}: {
  basemapId: number;
}) {
  const { t } = useTranslation("admin:basemaps");
  const onError = useGlobalErrorHandler();
  const { data } = useBasemapOfflineSettingsQuery({
    variables: {
      id: basemapId,
      slug: getSlug(),
    },
    onError,
  });
  const [mutate, mutationState] = useUpdateBasemapOfflineTileSettingsMutation();

  const projectSettings: Omit<OfflineTileSettingsFragment, "id"> | null =
    useMemo(() => {
      if (!data?.projectBySlug) {
        return null;
      } else {
        let projectSetting: Omit<OfflineTileSettingsFragment, "id"> =
          data.projectBySlug.offlineTileSettings.find(
            (s) => s.basemapId === null
          ) || {
            maxZ: 11,
            maxShorelineZ: 14,
            projectId: data.projectBySlug.id,
            region: {
              geojson: splitGeojson(
                cleanCoords(
                  data.projectBySlug.region.geojson
                ) as Feature<Polygon>
              ),
            },
          };
        return projectSetting;
      }
    }, [data]);

  const basemapSettings: Omit<OfflineTileSettingsFragment, "id"> | null =
    useMemo(() => {
      if (!data?.projectBySlug || !data?.basemap) {
        return null;
      } else {
        const basemapSettings = data.projectBySlug.offlineTileSettings.find(
          (s) => s.basemapId === basemapId
        );
        return basemapSettings || null;
      }
    }, [data, basemapId]);

  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (settings === null && data?.basemap && projectSettings) {
      const dbSettings = data.basemap.useDefaultOfflineTileSettings
        ? projectSettings
        : basemapSettings || projectSettings;
      setSettings({
        detailedShoreline: Boolean(dbSettings.maxShorelineZ),
        maxZ: dbSettings.maxZ,
        maxShorelineZ: dbSettings.maxShorelineZ || undefined,
        projectRegion: dbSettings.region.geojson,
        useDefault: data.basemap.useDefaultOfflineTileSettings,
      });
    }
  }, [settings, setSettings, projectSettings, basemapSettings, data?.basemap]);

  const dataSources = useStyleSources(
    data?.basemap?.url,
    data?.projectBySlug?.mapboxPublicKey ||
      process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
  );

  const debouncedMutate = useDebouncedFn(
    (
      basemapId: number,
      projectId: number,
      maxZ: number,
      useDefault: boolean,
      maxShorelineZ: number | null
    ) => {
      mutate({
        variables: {
          basemapId,
          projectId,
          maxZ,
          useDefault,
          maxShorelineZ,
        },
      });
    },
    250,
    { trailing: true },
    [mutate]
  );

  useEffect(() => {
    if (settings && basemapId && data?.projectBySlug?.id) {
      debouncedMutate(
        basemapId,
        data.projectBySlug.id,
        settings.maxZ,
        settings.useDefault,
        settings.detailedShoreline
          ? settings.maxShorelineZ || settings.maxZ + 1
          : null
      );
    }
  }, [settings, basemapId, data?.projectBySlug?.id]);

  const [z, setZ] = useState<number>(0);
  const [viewport, setViewport] = useState<BBox>();
  const [stats, setStats] = useState<
    {
      calculating: boolean;
    } & Partial<OfflineTileCacheStatus>
  >({ calculating: true });
  const [simulate, setSimulate] = useState(false);
  const [showTiles, setShowTiles] = useState(true);

  const mapContext = useContext(MapContext);

  function settingsToOfflineSettings(settings: Settings): OfflineTileSettings {
    if (settings.detailedShoreline) {
      return {
        maxZ: settings.maxZ,
        region: settings.projectRegion!,
        maxShorelineZ: Math.max(settings.maxShorelineZ!, settings.maxZ),
      };
    } else {
      return {
        region: settings.projectRegion!,
        maxZ: settings.maxZ,
      };
    }
  }

  const abortController = useRef<AbortController>(new AbortController());

  useEffect(() => {
    if (data?.basemap?.project?.region.geojson && mapContext.manager) {
      addTileLayers(mapContext.manager, data.basemap.project.region.geojson);

      return () => {
        if (mapContext.manager) {
          mapContext.manager.removeSource("project-region");
          mapContext.manager.removeSource("start-tile");
          mapContext.manager.removeLayer("project-region-outline");
          mapContext.manager.removeLayer("start-tile-outline");
        }
      };
    }
  }, [data?.basemap?.project?.region.geojson, mapContext.manager]);

  useEffect(() => {
    if (mapContext.manager && settings) {
      if (simulate) {
        mapContext.manager.enableOfflineTileSimulator(
          settingsToOfflineSettings(settings)
        );
      } else {
        mapContext.manager.disableOfflineTileSimulator();
      }
    }
  }, [settings, mapContext.manager, simulate]);

  useEffect(() => {
    if (mapContext.manager?.map) {
      const bounds = mapContext.manager.map.getBounds();
      setViewport([
        bounds.getWest(),
        bounds.getNorth(),
        bounds.getEast(),
        bounds.getSouth(),
      ]);
      setZ(Math.round(mapContext.manager.map.getZoom()));
      const listener = (e: MapboxEvent<MapWheelEvent>) => {
        if (mapContext?.manager?.map) {
          const bounds = mapContext.manager.map.getBounds();
          setViewport([
            bounds.getWest(),
            bounds.getNorth(),
            bounds.getEast(),
            bounds.getSouth(),
          ]);
          setZ(Math.round(mapContext.manager.map.getZoom()));
        }
      };
      const debouncedListener = debounce(listener, 32);
      mapContext.manager.map.on("zoom", debouncedListener);
      mapContext.manager.map.on("drag", debouncedListener);
      mapContext.manager.map.on("move", debouncedListener);
      return () => {
        if (mapContext?.manager?.map) {
          mapContext.manager.map.off("zoom", listener);
          mapContext.manager.map.off("drag", debouncedListener);
          mapContext.manager.map.off("move", debouncedListener);
        }
      };
    }
  }, [mapContext.manager?.map]);

  useEffect(() => {
    if (
      mapContext.manager?.map &&
      data?.basemap?.project?.region.geojson &&
      settings?.projectRegion &&
      showTiles
    ) {
      const region = data.basemap.project.region.geojson;
      const bounds = mapContext.manager.map.getBounds();
      Calculator.getTilesForScene(
        [
          bounds.getWest(),
          bounds.getNorth(),
          bounds.getEast(),
          bounds.getSouth(),
        ],
        z,
        settingsToOfflineSettings(settings)
      ).then((tiles: number[][]) => {
        const polygons = {
          type: "FeatureCollection",
          features: [],
        } as FeatureCollection<Polygon>;
        const points = {
          type: "FeatureCollection",
          features: [],
        } as FeatureCollection<Point>;
        for (const tile of tiles) {
          const [polygon, point] = tileToFeatures(tile);
          polygons.features.push(polygon);
          points.features.push(point);
          points.features.reverse();
        }
        if (mapContext.manager?.map) {
          let source = mapContext.manager.map.getSource("tile-bounds");
          if (!source) {
            addTileLayers(mapContext.manager, region, {
              polygons,
              points,
            });
          } else {
            if (source && source.type === "geojson") {
              source.setData(polygons);
            }
            const corners = mapContext.manager.map.getSource("tile-corners");
            if (corners && corners.type === "geojson") {
              corners.setData(points);
            }
          }
        }
      });
    } else {
      if (mapContext.manager?.map) {
        let source = mapContext.manager.map.getSource("tile-bounds");
        if (!source) {
          return;
        } else {
          if (source && source.type === "geojson") {
            source.setData({
              type: "FeatureCollection",
              features: [],
            });
          }
          const corners = mapContext.manager.map.getSource("tile-corners");
          if (corners && corners.type === "geojson") {
            corners.setData({
              type: "FeatureCollection",
              features: [],
            });
          }
        }
      }
    }
  }, [
    z,
    mapContext.manager?.map?.loaded,
    mapContext.manager?.map,
    settings,
    viewport,
    simulate,
    showTiles,
    mapContext.manager,
    data?.basemap?.project?.region.geojson,
  ]);

  const style = useMapboxStyle(data?.basemap?.url);

  useEffect(() => {
    (async () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      if (
        settings?.projectRegion &&
        data?.basemap?.id &&
        mapContext.manager?.map &&
        style.data
      ) {
        abortController.current = new AbortController();
        setStats((prev) => ({ calculating: true }));
        const ac = abortController.current;
        Calculator.cacheStatusForMap(
          settingsToOfflineSettings(settings),
          data?.basemap?.id,
          style.data
        ).then((status) => {
          if (!ac.signal.aborted) {
            setStats((prev) => ({ ...status, calculating: false }));
          }
        });
      }
    })();
  }, [settings, data?.basemap?.id, mapContext?.manager?.map, style.data]);

  if (!settings) {
    return <Spinner />;
  }

  return (
    <div className={`space-y-4`}>
      <h2 className="text-xl">{data?.basemap?.name}</h2>
      {dataSources.sources?.length && (
        <div className="mb-5 pb-5 border-b">
          <h3>{t("Data Sources")}</h3>
          {dataSources.sources.map((source) => (
            <div className="flex mt-1 space-x-2">
              <Badge>{source.type}</Badge>
              {/* @ts-ignore */}
              <span className="truncate text-sm" title={source.url}>
                {source.type === "vector" && source.url}
                {source.type === "raster" && source.url}
                {source.type === "raster-dem" && source.url}
              </span>
            </div>
          ))}
        </div>
      )}
      <InputBlock
        input={
          <Switch isToggled={simulate} onClick={(val) => setSimulate(val)} />
        }
        title={t("Simulate offline settings on the map")}
      />
      <InputBlock
        input={
          <Switch isToggled={showTiles} onClick={(v) => setShowTiles(v)} />
        }
        title={t("Show cached tile outlines")}
      />

      <RadioGroup
        className="mt-5"
        legend={t("Tiling Settings")}
        value={settings.useDefault}
        items={[
          {
            label: t("Use project defaults"),
            value: true,
            description: t(
              "Use project-wide settings to create tile packages for this basemap. Any changes to tiling settings will also impact all other basemaps using these default settings"
            ),
          },
          {
            label: t("Use map-specific settings"),
            value: false,
            description: t(
              "Configure custom tiling settings that apply to just this basemap. This can be useful for specifying a higher level of detail that the defaults for particular maps."
            ),
          },
        ]}
        onChange={(value) => {
          const newSettings =
            value === true
              ? projectSettings!
              : basemapSettings || projectSettings!;
          setSettings((prev) => ({
            ...prev,
            detailedShoreline: Boolean(newSettings.maxShorelineZ),
            maxZ: newSettings.maxZ,
            maxShorelineZ: newSettings.maxShorelineZ || undefined,
            projectRegion: newSettings.region.geojson,
            useDefault: value,
          }));
        }}
      />
      <InputBlock
        title={t("Max Zoom")}
        input={
          <span className="flex items-center">
            <span className="text-sm px-2">{settings.maxZ}</span>
            <input
              type="range"
              value={settings.maxZ}
              min="8"
              max="16"
              onChange={(e) => {
                setSettings((prev) => {
                  const value = parseInt(e.target.value);
                  let maxShorelineZ = prev?.maxShorelineZ;
                  if (prev?.maxShorelineZ && value >= prev?.maxShorelineZ) {
                    maxShorelineZ = value + 1;
                  }
                  if (value !== prev?.maxZ) {
                    return {
                      ...prev!,
                      maxZ: value,
                      maxShorelineZ,
                    };
                  } else {
                    return prev;
                  }
                });
              }}
            />
          </span>
        }
      />
      <InputBlock
        input={
          <Switch
            isToggled={settings.detailedShoreline}
            onClick={(v) => {
              setSettings((prev) => ({
                ...prev!,
                detailedShoreline: v,
                maxShorelineZ:
                  settings.maxShorelineZ &&
                  settings.maxShorelineZ > settings.maxZ
                    ? settings.maxShorelineZ
                    : settings.maxZ + 1,
              }));
            }}
          />
        }
        title={t("Cache higher detail near shore")}
      />

      <InputBlock
        title={t("Max Zoom At Shoreline")}
        input={
          <span className="flex items-center">
            <span className="text-sm px-2">{settings.maxShorelineZ}</span>
            <input
              type="range"
              value={settings.maxShorelineZ || 0}
              min="8"
              max="16"
              onChange={(e) => {
                setSettings((prev) => {
                  let value = parseInt(e.target.value);
                  if (value <= prev!.maxZ) {
                    value = prev!.maxZ + 1;
                  }
                  if (value !== prev?.maxShorelineZ) {
                    return {
                      ...prev!,
                      maxShorelineZ: value,
                    };
                  } else {
                    return prev;
                  }
                });
              }}
            />
          </span>
        }
      />
      <div className="flex items-center">
        <h4 className="flex-1">{t("Calculated Tile Count")}</h4>
        <span>
          {stats.calculating ? <Spinner /> : stats.totalTiles?.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center">
        <h4 className="flex-1">{t("Estimated tile package size")}</h4>
        <span>
          {stats.calculating ? <Spinner /> : bytes(stats.totalTiles! * 10000)}
        </span>
      </div>
      <div className="flex items-center">
        <h4 className="flex-1">
          {t("MapBox fees to generate package (w/o free tier)")}
        </h4>
        <span>
          {stats.calculating ? (
            <Spinner />
          ) : (
            `$${Math.round((stats.totalTiles! / 1000) * 0.25 * 100) / 100}`
          )}
        </span>
      </div>
    </div>
  );
}

function tileToFeatures(tile: number[]): [Feature<Polygon>, Feature<Point>] {
  const polygon = tilebelt.tileToGeoJSON(tile);
  return [
    {
      type: "Feature",
      properties: {
        x: tile[0],
        y: tile[1],
        z: tile[2],
      },
      geometry: polygon,
    },
    {
      type: "Feature",
      properties: {
        x: tile[0],
        y: tile[1],
        z: tile[2],
      },
      geometry: {
        type: "Point",
        coordinates: polygon.coordinates[0][0],
      },
    },
  ];
}

/**
 * Inputs
 *   simple
 *   * max z
 *
 *   * max z at shoreline
 *   * max z for entire
 *
 */
