import * as MapboxDraw from "@mapbox/mapbox-gl-draw";

const DrawPoint = MapboxDraw.modes.draw_point;

const _onSetup = DrawPoint.onSetup;

DrawPoint.onSetup = function (opts?: {
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

// see https://github.com/mapbox/mapbox-gl-draw/blob/main/src/constants.js
// unfortunately not exported
const Constants = {
  cursors: {
    ADD: "add",
    MOVE: "move",
  },
  modes: {
    DRAW_LINE_STRING: "draw_line_string",
    DRAW_POLYGON: "draw_polygon",
    DRAW_POINT: "draw_point",
    SIMPLE_SELECT: "simple_select",
    DIRECT_SELECT: "direct_select",
    STATIC: "static",
  },
  events: {
    CREATE: "draw.create",
  },
};

DrawPoint.onTap = DrawPoint.onClick = function (state: any, e: any) {
  this.updateUIClasses({ mouse: Constants.cursors.MOVE });
  state.point.updateCoordinate("", e.lngLat.lng, e.lngLat.lat);
  this.map.fire(Constants.events.CREATE, {
    features: [state.point.toGeoJSON()],
  });
  if (state.getNextMode) {
    this.changeMode.apply(this, state.getNextMode(state.point.id));
  } else {
    this.changeMode(Constants.modes.SIMPLE_SELECT, {
      featureIds: [state.point.id],
    });
  }
};

export default DrawPoint;
