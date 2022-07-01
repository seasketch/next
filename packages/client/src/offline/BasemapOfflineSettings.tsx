import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import InputBlock from "../components/InputBlock";
import { useBasemapOfflineSettingsQuery } from "../generated/graphql";
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
import { GeoJSONSource, MapboxEvent, MapWheelEvent } from "mapbox-gl";
import debounce from "lodash.debounce";
import splitGeojson from "geojson-antimeridian-cut";
import { cleanCoords } from "../workers/utils";
import {
  MapTileCacheCalculator,
  OfflineTileCacheStatus,
  OfflineTileSettings,
} from "./MapTileCache";
import Button from "../components/Button";
import mapboxgl from "mapbox-gl";
import bytes from "bytes";

let worker: any;
let Calculator: MapTileCacheCalculator;
if (process.env.NODE_ENV === "test") {
  worker = { getChildTiles: () => 0 };
} else {
  import("../workers/index").then((mod) => {
    worker = new mod.default();
    Calculator = worker.mapTileCacheCalculator as MapTileCacheCalculator;
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
};

export default function BasemapOfflineSettings({
  basemapId,
  className,
}: {
  basemapId: number;
  className?: string;
}) {
  const { t } = useTranslation("admin:basemaps");
  const onError = useGlobalErrorHandler();
  const { data, loading, error } = useBasemapOfflineSettingsQuery({
    variables: {
      id: basemapId,
    },
    onError,
  });

  const [settings, setSettings] = useState<Settings>({
    maxZ: 9,
    maxShorelineZ: 11,
    detailedShoreline: true,
  });
  const [z, setZ] = useState<number>(0);
  const [viewport, setViewport] = useState<BBox>();
  const [stats, setStats] = useState<
    {
      calculating: boolean;
    } & Partial<OfflineTileCacheStatus>
  >({ calculating: true });
  const [simulate, setSimulate] = useState(false);
  const [showTiles, setShowTiles] = useState(false);

  const mapContext = useContext(MapContext);

  function settingsToOfflineSettings(settings: Settings): OfflineTileSettings {
    if (!settings.projectRegion) {
      throw new Error("projectRegion must be set");
    }
    if (settings.detailedShoreline === true) {
      return {
        maxZ: settings.maxZ,
        region: settings.projectRegion!,
        maxShorelineZ: Math.max(settings.maxShorelineZ!, settings.maxZ),
        levelOfDetail: 0,
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
    if (data?.basemap?.project?.region.geojson) {
      setSettings((prev) => {
        if (data?.basemap?.project?.region.geojson) {
          return {
            ...prev,
            projectRegion: splitGeojson(
              cleanCoords(
                data.basemap.project.region.geojson
              ) as Feature<Polygon>
            ),
          };
        } else {
          return {
            ...prev,
            projectRegion: undefined,
          };
        }
      });
    }
  }, [data?.basemap?.project?.region.geojson]);

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
    if (mapContext.manager) {
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
      settings.projectRegion &&
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
  ]);

  useEffect(() => {
    (async () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      if (
        settings.projectRegion &&
        data?.basemap?.id &&
        mapContext.manager?.map
      ) {
        abortController.current = new AbortController();
        setStats((prev) => ({ calculating: true }));
        const ac = abortController.current;
        Calculator.cacheStatusForMap(
          settingsToOfflineSettings(settings),
          data?.basemap?.id,
          mapContext.manager.map.getStyle()
        ).then((status) => {
          if (!ac.signal.aborted) {
            setStats((prev) => ({ ...status, calculating: false }));
          }
        });
      }
    })();
  }, [settings, data?.basemap?.id, mapContext?.manager?.map]);

  return (
    <div className={`space-y-4 ${className}`}>
      <InputBlock
        input={
          <input
            type="checkbox"
            checked={simulate}
            onClick={() => setSimulate((prev) => !simulate)}
          />
        }
        title={t("Simulate offline settings on the map")}
      />
      <InputBlock
        input={
          <input
            type="checkbox"
            checked={showTiles}
            onClick={() => setShowTiles((prev) => !showTiles)}
          />
        }
        title={t("Show cached tile outlines")}
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
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  maxZ: parseInt(e.target.value),
                }))
              }
            />
          </span>
        }
      />
      <InputBlock
        input={
          <input
            type="checkbox"
            checked={settings.detailedShoreline}
            onClick={(e) =>
              setSettings((prev) => ({
                ...prev,
                // @ts-ignore
                detailedShoreline: e.target.checked,
              }))
            }
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
              value={settings.maxShorelineZ}
              min="8"
              max="16"
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  maxShorelineZ: parseInt(e.target.value),
                }))
              }
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
        <h4 className="flex-1">{t("Estimated MapBox fees per Download")}</h4>
        <span>
          {stats.calculating ? (
            <Spinner />
          ) : (
            `$${Math.round((stats.totalTiles! / 1000) * 0.25 * 100) / 100}`
          )}
        </span>
      </div>
      <div className="flex items-center">
        <h4 className="flex-1">{t("Cached Tiles")}</h4>
        <span>
          {stats.calculating ? (
            <Spinner />
          ) : (
            `${stats.cachedTileCount?.toLocaleString()}/${stats.totalTiles?.toLocaleString()} (${bytes(
              stats.bytes || 0
            )})`
          )}
        </span>
      </div>
      <Button
        label={t("Populate tile cache")}
        onClick={async () => {
          const style = mapContext.manager?.map?.getStyle();
          if (style) {
            const status = await Calculator.populateCache(
              settingsToOfflineSettings(settings),
              data!.basemap!.id,
              style,
              mapboxgl.accessToken
            );
            setStats({ calculating: false, ...status });
          }
        }}
      />
    </div>
  );
}

const downloadURL = (data: string, fileName: string) => {
  const a = document.createElement("a");
  a.href = data;
  a.download = fileName;
  document.body.appendChild(a);
  a.style.display = "none";
  a.click();
  a.remove();
};

const downloadBlob = (data: Uint8Array, fileName: string, mimeType: string) => {
  const blob = new Blob([data], {
    type: mimeType,
  });

  const url = window.URL.createObjectURL(blob);

  downloadURL(url, fileName);

  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

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
