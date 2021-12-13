import * as MapboxDraw from "@mapbox/mapbox-gl-draw";
import { DragTargetEvent } from "./SimpleSelect";
import { DigitizingDragTarget } from "./useMapboxGLDraw";

const DirectSelect = MapboxDraw.modes.direct_select;

const _dragVertex = DirectSelect.dragVertex;
const _stopDragging = DirectSelect.stopDragging;

DirectSelect.stopDragging = function (state: any, e: any) {
  this.map.fire("seasketch.drag_target", {} as DragTargetEvent);
  return _stopDragging.apply(this, [state, e]);
};

DirectSelect.dragVertex = function (state: any, e: any, delta: any) {
  const ret = _dragVertex.apply(this, [state, e, delta]);
  if ((delta.lng || delta.lat) && state.feature) {
    const selectedCoords = state.selectedCoordPaths.map((coord_path: string) =>
      state.feature.getCoordinate(coord_path)
    );
    this.map.fire("seasketch.drag_target", {
      coordinates: selectedCoords[0],
      point: e.point,
    } as DragTargetEvent);
  }
  return ret;
};

export default DirectSelect;
