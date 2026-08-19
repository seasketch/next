export type RasterArrayLayerJson = {
  id: string;
  minzoom: number;
  maxzoom: number;
  fields: {
    name: string;
    bands: string[];
    tilesize: number;
    buffer: number;
    units: string;
    scale: number;
    offset: number;
    range: [number, number];
  };
};

export type RasterArrayTileJson = {
  tilejson: "3.0.0";
  name: string;
  format: "mrt";
  scheme: "xyz";
  tiles: string[];
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  center: [number, number, number];
  raster_layers: RasterArrayLayerJson[];
};

export function buildTileJson(options: {
  name: string;
  tiles: string[];
  minzoom: number;
  maxzoom: number;
  /** WGS84 [west, south, east, north] */
  bounds: [number, number, number, number];
  layers: Array<{
    id: string;
    bands: string[];
    tileSize: number;
    buffer: number;
    units?: string;
    scale: number;
    offset: number;
    range: [number, number];
  }>;
}): RasterArrayTileJson {
  const { name, tiles, minzoom, maxzoom, bounds, layers } = options;
  const center: [number, number, number] = [
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
    Math.min(maxzoom, minzoom + 2),
  ];
  return {
    tilejson: "3.0.0",
    name,
    format: "mrt",
    scheme: "xyz",
    tiles,
    minzoom,
    maxzoom,
    bounds,
    center,
    raster_layers: layers.map((layer) => ({
      id: layer.id,
      minzoom,
      maxzoom,
      fields: {
        name: layer.id,
        bands: layer.bands,
        tilesize: layer.tileSize,
        buffer: layer.buffer,
        units: layer.units ?? "",
        scale: layer.scale,
        offset: layer.offset,
        range: layer.range,
      },
    })),
  };
}
