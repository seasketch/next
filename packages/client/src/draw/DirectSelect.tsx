import * as MapboxDraw from "@mapbox/mapbox-gl-draw";
import { DragTargetEvent } from "./SimpleSelect";
import getKinks from "@turf/kinks";
import { Feature } from "geojson";
import * as MapboxDrawWaypoint from "mapbox-gl-draw-waypoint";

const DirectSelect = MapboxDrawWaypoint.enable({
  direct_select: MapboxDraw.modes.direct_select,
}).direct_select;

const _dragVertex = DirectSelect.dragVertex;
const _stopDragging = DirectSelect.stopDragging;
const _onSetup = DirectSelect.onSetup;
const _clickNoTarget = DirectSelect.clickNoTarget;

DirectSelect.onSetup = function (opts: any) {
  const state = _onSetup.apply(this, [opts]);
  this.checkForKinks(state);
  return state;
};

DirectSelect.stopDragging = function (state: any, e: any) {
  this.map.fire("seasketch.drag_target", {} as DragTargetEvent);
  return _stopDragging.apply(this, [state, e]);
};

DirectSelect.dragVertex = function (state: any, e: any, delta: any) {
  const ret = _dragVertex.apply(this, [state, e, delta]);
  this.checkForKinks(state);
  return ret;
};

DirectSelect.checkForKinks = function (state: any) {
  if (state.feature && state.feature.type === "Polygon") {
    state.kinks = getKinks(state.feature.toGeoJSON());
    this.map.fire("seasketch.kinks", {
      hasKinks: state.kinks.features.length > 0,
    });
  }
};

const _onTrash = DirectSelect.onTrash;
DirectSelect.onTrash = function (state: any) {
  _onTrash.apply(this, [state]);
  this.checkForKinks(state);
};

const _toDisplayFeatures = DirectSelect.toDisplayFeatures;

DirectSelect.toDisplayFeatures = function (
  state: any,
  geojson: any,
  push: (feature: Feature<any>) => void
) {
  if (geojson.properties.id === state.featureId) {
    const hasKinks = state.kinks.features.length > 0;
    geojson.properties.kinks = hasKinks ? "true" : "false";
    if (hasKinks) {
      for (const feature of state.kinks.features) {
        feature.properties.meta = "self-intersection";
        feature.properties.parent = state.featureId;
        push(feature);
      }
    }
  }
  _toDisplayFeatures.apply(this, [state, geojson, push]);
};

DirectSelect.onTouchEnd = DirectSelect.onMouseUp = function (state: any) {
  // I'm not sure there's any value in preventing this from firing if
  // state.dragMoving is false, as seen in the source at:
  // https://github.com/mapbox/mapbox-gl-draw/blob/main/src/modes/direct_select.js#L238
  // I think this may solve the following issue with flacky update events:
  // https://github.com/mapbox/mapbox-gl-draw/issues/684
  // if (state.dragMoving) {
  this.fireUpdate();
  // }
  this.stopDragging(state);
};

const _fireUpdate = DirectSelect.fireUpdate;
DirectSelect.fireUpdate = function () {
  const selected = this.getSelected();
  if (selected.length === 1 && selected[0].type === "Polygon") {
    const feature = selected[0];
    const kinks = getKinks(feature.toGeoJSON());
    if (kinks.features.length > 0) {
      // don't do update
    } else {
      _fireUpdate.apply(this, []);
    }
  } else {
    _fireUpdate.apply(this, []);
  }
  // this.map.fire(Constants.events.UPDATE, {
  //   action: Constants.updateActions.CHANGE_COORDINATES,
  //   features: this.getSelected().map((f) => f.toGeoJSON()),
  // });
};

DirectSelect.clickNoTarget = function (state: any, e: any) {
  if (state.kinks.features.length > 0) {
    // clear coordinate selection but don't allow change of mode
    state.selectedCoordPaths = [];
    this.clearSelectedCoordinates();
    state.feature.changed();
    return false;
  } else {
    return _clickNoTarget.apply(this, [state, e]);
  }
};

const _clickInactive = DirectSelect.clickInactive;
DirectSelect.clickInactive = function (state: any, e: any) {
  if (state.kinks.features.length > 0) {
    // do nothing. don't allow switching away
  } else {
    _clickInactive.apply(this, [state, e]);
  }
  // this.changeMode(Constants.modes.SIMPLE_SELECT);
};

const _onMouseMove = DirectSelect.onMouseMove;
DirectSelect.onMouseMove = function (state: any, e: any) {
  const result = _onMouseMove.apply(this, [state, e]);
  if (state.kinks.features.length > 0) {
    if (
      e.featureTarget?.properties?.active === "false" &&
      e.featureTarget?.properties?.meta === "feature"
    ) {
      this.updateUIClasses({ mouse: "not-allowed" });
    }
  }
  return result;
};

export default DirectSelect;