import * as MapboxDraw from "@mapbox/mapbox-gl-draw";

const DrawLineString = MapboxDraw.modes.draw_line_string;

const _onSetup = DrawLineString.onSetup;

DrawLineString.onSetup = function (opts?: {
  getNextMode: (id: string) => [string, any];
}) {
  const state = _onSetup.apply(this, []);
  if (opts?.getNextMode) {
    if (typeof opts.getNextMode !== "function") {
      throw new Error("getNextMode option must be a function");
    }
  }
  return {
    ...state,
    getNextMode: opts?.getNextMode,
  };
};

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

DrawLineString.clickOnVertex = function (state: any) {
  if (state.getNextMode) {
    this.changeMode.apply(this, state.getNextMode(state.line.id));
  } else {
    this.changeMode.apply("simple_select", state.getNextMode(state.line.id));
  }
};

export default DrawLineString;
