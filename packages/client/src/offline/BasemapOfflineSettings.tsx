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
import bytes from "bytes";
import getSlug from "../getSlug";
import Switch from "../components/Switch";
import { useDebouncedFn } from "beautiful-react-hooks";
import RadioGroup from "../components/RadioGroup";
import { useMapboxStyle } from "../useMapboxStyle";
import Badge from "../components/Badge";
import {
  OfflineTilePackageSourceType,
  OfflineTileSettingsForCalculationFragment,
} from "../generated/queries";
import { OfflineTileSettings } from "./OfflineTileSettings";
import Calculator from "../TileCalculator";
import Warning from "../components/Warning";

export const defaultOfflineTilingSettings: OfflineTileSettingsForCalculationFragment =
  {
    maxZ: 11,
    maxShorelineZ: 14,
  };

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
    data: splitGeojson(cleanCoords(region) as Feature<Polygon>),
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
  const [mutate] = useUpdateBasemapOfflineTileSettingsMutation({
    onError,
  });

  const projectSettings: Omit<OfflineTileSettingsFragment, "id"> | null =
    useMemo(() => {
      if (!data?.projectBySlug) {
        return null;
      } else {
        let projectSetting: Omit<OfflineTileSettingsFragment, "id"> =
          data.projectBySlug.offlineTileSettings.find(
            (s) => s.basemapId === null
          ) || {
            ...defaultOfflineTilingSettings,
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
    }, [data?.projectBySlug]);

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
        projectRegion: data.projectBySlug?.region.geojson,
        useDefault: data.basemap.useDefaultOfflineTileSettings,
      });
    }
  }, [settings, setSettings, projectSettings, basemapSettings, data?.basemap]);

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

  const mounted = useRef(false);

  useEffect(() => {
    if (settings && basemapId && data?.projectBySlug?.id) {
      // Prevent saving of setting on mount. Wait until user interaction
      if (mounted.current === false) {
        mounted.current = true;
        return;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const [z, setZ] = useState<number>(0);
  const [viewport, setViewport] = useState<BBox>();
  const [stats, setStats] = useState<
    {
      calculating: boolean;
      error?: string;
    } & { totalTiles?: number }
  >({ calculating: true });
  const [simulate, setSimulate] = useState(false);
  const [showTiles, setShowTiles] = useState(true);

  const mapContext = useContext(MapContext);

  function settingsToOfflineSettings(settings: Settings): OfflineTileSettings {
    if (settings.detailedShoreline) {
      return {
        maxZ: settings.maxZ,
        region: splitGeojson(
          cleanCoords(data?.projectBySlug?.region.geojson) as Feature<Polygon>
        ),
        maxShorelineZ: Math.max(settings.maxShorelineZ!, settings.maxZ),
      };
    } else {
      return {
        region: splitGeojson(
          cleanCoords(data?.projectBySlug?.region.geojson) as Feature<Polygon>
        ),
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
          mapContext.manager.map.off("zoom", debouncedListener);
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
      )
        .then((tiles: number[][]) => {
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
        })
        .catch((e) => {
          if (/region/.test(e)) {
            // do nothing, region is too big
          } else {
            throw e;
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
        Calculator.countChildTiles(settingsToOfflineSettings(settings))
          .then((totalTiles) => {
            if (!ac.signal.aborted) {
              setStats((prev) => ({ calculating: false, totalTiles }));
            }
          })
          .catch((e) => {
            setStats((prev) => ({
              ...prev,
              error: e.toString(),
              calculating: false,
            }));
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
      {data?.basemap?.offlineSupportInformation && (
        <div className="mb-5 pb-5 border-b">
          <h3>{t("Data Sources")}</h3>
          {data.basemap.offlineSupportInformation.sources.map((source) => (
            <div key={source.dataSourceUrl} className="flex mt-1 space-x-2">
              <Badge>{source.type.toLowerCase()}</Badge>
              <span className="truncate text-sm" title={source.dataSourceUrl}>
                {source.type === OfflineTilePackageSourceType.Vector &&
                  source.dataSourceUrl}
                {source.type === OfflineTilePackageSourceType.Raster &&
                  source.dataSourceUrl}
                {source.type === OfflineTilePackageSourceType.RasterDem &&
                  source.dataSourceUrl}
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
            projectRegion: data?.projectBySlug?.region.geojson,
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
          {stats.calculating ? <Spinner /> : bytes(stats.totalTiles! * 40000)}
        </span>
      </div>
      <div className="flex items-center">
        <h4 className="flex-1">
          {t("MapBox fees to generate package (w/o free tier)")}
        </h4>
        <span>
          {stats.calculating ? (
            <Spinner />
          ) : stats.totalTiles ? (
            `$${Math.round((stats.totalTiles! / 1000) * 0.25 * 100) / 100}`
          ) : (
            ""
          )}
        </span>
      </div>
      {stats.error && <Warning level="error">{stats.error.toString()}</Warning>}
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
