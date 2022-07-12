import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
import bboxPolygon from "@turf/bbox-polygon";
import splitGeojson from "geojson-antimeridian-cut";
import { cleanCoords } from "../workers/utils";
import { AnySourceData, Style } from "mapbox-gl";
import { MapTileCacheCalculator as Calculator } from "@seasketch/map-tile-cache-calculator";
import { useMapboxStyle } from "../useMapboxStyle";
import { useEffect, useState } from "react";
import {
  DetailedShorelineOfflineTileSettings,
  OfflineTileSettings,
} from "./OfflineTileSettings";

const X = 0;
const Y = 1;
const Z = 2;

export class SceneTileCalculator {
  public calculator: Calculator;

  constructor() {
    this.calculator = new Calculator("https://d3p1dsef9f0gjr.cloudfront.net/");
    return this;
  }

  async getTilesForScene(
    bbox: BBox,
    z: number,
    settings: DetailedShorelineOfflineTileSettings | OfflineTileSettings
  ): Promise<number[][]> {
    const tiles: number[][] = [];
    const viewport = splitGeojson(
      cleanCoords(bboxPolygon(bbox)) as Feature<Polygon>
    );
    await this.calculator.traverseOfflineTiles(
      settings,
      (tile, stop) => {
        if (tile[Z] > z + 4) {
          stop();
        } else {
          tiles.push(tile);
        }
      },
      viewport.geometry
    );
    return tiles;
  }
}

function urlForSource(source: AnySourceData) {
  switch (source.type) {
    case "vector":
    case "raster":
    case "raster-dem":
      return source.tiles ? source.tiles[0] : source.url!;
    default:
      throw new Error(`Source of type ${source.type} not supported`);
  }
}

export function cacheNameForSource(url: string) {
  // eslint-disable-next-line i18next/no-literal-string
  return `data-source-${url}`;
}

export const MAP_STATIC_ASSETS_CACHE_NAME = `offline-basemap-static-assets`;

export type BasemapCacheStatus = {
  status: "incomplete" | "empty" | "complete";
  completeSourceTiles: boolean;
  completeStyleAssets: boolean;
};

export async function cacheStatusForBasemap(id: number) {
  let completeSourceTiles = false;
  let completeStyleAssets = false;
  // graphql data included in survey query so no need to cache
  return {
    completeSourceTiles,
    completeStyleAssets,
    status:
      completeSourceTiles && completeStyleAssets
        ? "complete"
        : [completeSourceTiles, completeStyleAssets].find((a) => a)
        ? "incomplete"
        : "empty",
  } as BasemapCacheStatus;
}
