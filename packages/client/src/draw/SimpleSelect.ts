import * as MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Feature } from "geojson";
import { LngLatLike } from "mapbox-gl";
import getKinks from "@turf/kinks";
import * as MapboxDrawWaypoint from "mapbox-gl-draw-waypoint";

const SimpleSelect = MapboxDrawWaypoint.enable({
  simple_select: MapboxDraw.modes.simple_select,
}).simple_select;

const _dragMove = SimpleSelect.dragMove;
const _onTouchEnd = SimpleSelect.onTouchEnd;

export type DragTargetEvent =
  | {
      coordinates: LngLatLike;
      point: { x: number; y: number };
    }
  | {};

SimpleSelect.onMouseUp = SimpleSelect.onTouchEnd = function (
  state: any,
  e: any
) {
  this.map.fire("seasketch.drag_target", {});
  return _onTouchEnd.apply(this, [state, e]);
};

SimpleSelect.dragMove = function (state: any, e: any) {
  const delta =
    Math.abs(e.lngLat.lng - state.dragMoveLocation.lng) +
    Math.abs(e.lngLat.lat - state.dragMoveLocation.lat);
  const r = _dragMove.apply(this, [state, e]);

  if (delta) {
    this.map.fire("seasketch.drag_target", {
      coordinates: this.getSelected()[0].coordinates,
      point: e.point,
    } as DragTargetEvent);
  }

  return r;
};

const _toDisplayFeatures = SimpleSelect.toDisplayFeatures;

SimpleSelect.toDisplayFeatures = function (
  state: any,
  geojson: any,
  push: (feature: Feature<any>) => void
) {
  if (geojson.geometry?.type === "Polygon") {
    const kinks = getKinks(geojson);
    if (kinks.features.length > 0) {
      geojson.properties.kinks = "true";
    }
  }

  return _toDisplayFeatures.apply(this, [state, geojson, push]);
};
export default SimpleSelect;
