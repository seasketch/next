import DS from "./DirectSelect";
import * as MapboxDrawWaypoint from "mapbox-gl-draw-waypoint";

const DirectSelect = MapboxDrawWaypoint.enable({
  direct_select: DS,
}).direct_select;

const _onSetup = DirectSelect.onSetup;

const UnfinishedFeatureSelect = {
  ...DirectSelect,
};

UnfinishedFeatureSelect.onSetup = function (opts: any) {
  const state = _onSetup.apply(this, [opts]);
  return state;
};

UnfinishedFeatureSelect.clickNoTarget = function (state: any, e: any) {
  // clear coordinate selection but don't allow change of mode
  state.selectedCoordPaths = [];
  this.clearSelectedCoordinates();
  state.feature.changed();
  return false;
};

UnfinishedFeatureSelect.clickInactive = function () {
  // do nothing. don't allow switching away
  // this.changeMode(Constants.modes.SIMPLE_SELECT);
};

UnfinishedFeatureSelect.onMouseMove = function (state: any, e: any) {
  const result = DirectSelect.onMouseMove.apply(this, [state, e]);
  if (
    e.featureTarget?.properties?.active === "false" &&
    e.featureTarget?.properties?.meta === "feature"
  ) {
    this.updateUIClasses({ mouse: "not-allowed" });
  }
  return result;
};

export default UnfinishedFeatureSelect;
