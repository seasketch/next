import * as MapboxDraw from "@mapbox/mapbox-gl-draw";
import { LngLatLike } from "mapbox-gl";

const SimpleSelect = MapboxDraw.modes.simple_select;

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

export default SimpleSelect;
