import * as MapboxDraw from "@mapbox/mapbox-gl-draw";

const DrawPolygon = MapboxDraw.modes.draw_polygon;

const _clickAnywhere = DrawPolygon.clickAnywhere;

DrawPolygon.clickAnywhere = function (state: any, e: MouseEvent) {
  const result = _clickAnywhere.apply(this, [state, e]);
  if (state.currentVertexPosition && state.currentVertexPosition > 2) {
    this.map.fire("seasketch.can_complete");
  } else {
    this.map.fire("seasketch.drawing_started");
  }
  return result;
};

export default DrawPolygon;
