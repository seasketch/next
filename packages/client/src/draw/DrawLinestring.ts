import * as MapboxDraw from "@mapbox/mapbox-gl-draw";

const DrawLineString = MapboxDraw.modes.draw_line_string;

const _clickAnywhere = DrawLineString.clickAnywhere;

DrawLineString.clickAnywhere = function (
  state: any,
  e: MouseEvent,
  delta: any
) {
  const result = _clickAnywhere.apply(this, [state, e, delta]);
  this.map.fire("seasketch.drawing_started");
  return result;
};

export default DrawLineString;
