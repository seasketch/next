import * as MapboxDraw from "@mapbox/mapbox-gl-draw";
import { LngLat } from "mapbox-gl";
import getKinks from "@turf/kinks";

// see https://github.com/mapbox/mapbox-gl-draw/blob/main/src/constants.js
// unfortunately not exported
const Constants = {
  cursors: {
    ADD: "add",
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

// https://github.com/mapbox/mapbox-gl-draw/blob/main/src/lib/is_event_at_coordinates.js
// also not exported
function isEventAtCoordinates(
  event: { lngLat?: LngLat },
  coordinates: [number, number]
) {
  if (!event.lngLat) return false;
  return (
    event.lngLat.lng === coordinates[0] && event.lngLat.lat === coordinates[1]
  );
}

const DrawPolygon = MapboxDraw.modes.draw_polygon;

const _clickAnywhere = DrawPolygon.clickAnywhere;
const _clickOnVertex = DrawPolygon.clickOnVertex;

// DrawPolygon.clickAnywhere = function (state: any, e: MouseEvent) {
//   const result = _clickAnywhere.apply(this, [state, e]);
//   if (state.currentVertexPosition && state.currentVertexPosition > 2) {
//     this.map.fire("seasketch.can_complete");
//   } else {
//     this.map.fire("seasketch.drawing_started");
//   }
//   return result;
// };

DrawPolygon.clickAnywhere = function (state: any, e: any) {
  if (
    state.currentVertexPosition > 0 &&
    isEventAtCoordinates(
      e,
      state.polygon.coordinates[0][state.currentVertexPosition - 1]
    )
  ) {
    if (state.getNextMode) {
      this.changeMode.apply(this, state.getNextMode(state.polygon.id));
    } else {
      return this.changeMode("simple_select", {
        featureIds: [state.polygon.id],
      });
    }
  }
  if (state.currentVertexPosition && state.currentVertexPosition > 2) {
    this.map.fire("seasketch.can_complete");
  } else {
    this.map.fire("seasketch.drawing_started");
  }
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  state.polygon.updateCoordinate(
    `0.${state.currentVertexPosition}`,
    e.lngLat.lng,
    e.lngLat.lat
  );
  state.currentVertexPosition++;
  state.polygon.updateCoordinate(
    `0.${state.currentVertexPosition}`,
    e.lngLat.lng,
    e.lngLat.lat
  );
  if (state.currentVertexPosition && state.currentVertexPosition > 1) {
    this.checkForKinks(state);
  }
  // if (state.polygon.coordinates[0].length > 3) {
  //   console.log("click anywhere", state.polygon);
  // }
};

DrawPolygon.checkForKinks = function (state: any) {
  if (
    state.polygon &&
    state.polygon.coordinates &&
    state.polygon.coordinates[0] &&
    state.polygon.coordinates[0].length > 3
  ) {
    state.kinks = getKinks({
      type: "Feature",
      geometry: state.polygon,
    });
    this.map.fire("seasketch.kinks", {
      hasKinks: state.kinks.features.length > 0,
    });
  }
};

DrawPolygon.clickOnVertex = function (state: any) {
  if (
    !state.polygon.coordinates.length ||
    state.polygon.coordinates[0].length < 4
  ) {
    // Avoid exceptions when user clicks on an existing vertex before a polygon has enough vertices
    return;
  } else {
    if (state.getNextMode) {
      this.changeMode.apply(
        this,
        state.getNextMode(state.polygon.id, state.kinks?.features.length > 0)
      );
    } else {
      return _clickOnVertex(state);
    }
  }
};

const _onSetup = DrawPolygon.onSetup;

DrawPolygon.onSetup = function (opts?: {
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

export default DrawPolygon;
