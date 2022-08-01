declare module "@mapbox/mapbox-gl-draw";
declare module "mapbox-gl-draw-rectangle-restrict-area";
declare module "mapbox-gl-draw-rectangle-mode";
declare module "@mapbox/mapbox-gl-draw-static-mode";
declare module "prosemirror-example-setup";
declare module "mapbox-gl-draw-waypoint";
declare module "geojson-antimeridian-cut" {
  import {
    LineString,
    MultiLineString,
    Polygon,
    MultiPolygon,
    Feature,
    FeatureCollection,
    GeometryCollection,
  } from "geojson";

  function splitGeojson(geojson: MultiLineString): MultiLineString;
  function splitGeojson(
    geojson: LineString | MultiLineString
  ): LineString | MultiLineString;
  function splitGeojson(geojson: MultiPolygon): MultiPolygon;
  function splitGeojson(
    geojson: Polygon | MultiPolygon
  ): Polygon | MultiPolygon;
  function splitGeojson(
    geojson: Feature<MultiLineString>
  ): Feature<MultiLineString>;
  function splitGeojson(
    geojson: Feature<LineString | MultiLineString>
  ): Feature<LineString | MultiLineString>;
  function splitGeojson(geojson: Feature<MultiPolygon>): Feature<MultiPolygon>;
  function splitGeojson(
    geojson: Feature<Polygon | MultiPolygon>
  ): Feature<Polygon | MultiPolygon>;
  function splitGeojson(
    geojson: FeatureCollection<MultiLineString>
  ): FeatureCollection<MultiLineString>;
  function splitGeojson(
    geojson: FeatureCollection<LineString | MultiLineString>
  ): FeatureCollection<LineString | MultiLineString>;
  function splitGeojson(
    geojson: FeatureCollection<MultiPolygon>
  ): FeatureCollection<MultiPolygon>;
  function splitGeojson(
    geojson: FeatureCollection<Polygon | MultiPolygon>
  ): FeatureCollection<Polygon | MultiPolygon>;
  function splitGeojson(geojson: GeometryCollection): GeometryCollection;

  export = splitGeojson;
}
