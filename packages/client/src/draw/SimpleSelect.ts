import * as MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Feature } from "geojson";
import { LngLatLike } from "mapbox-gl";
import getKinks from "@turf/kinks";

const SimpleSelect = MapboxDraw.modes.simple_select;

const _dragMove = SimpleSelect.dragMove;
const _onTouchEnd = SimpleSelect.onTouchEnd;
const _onSetup = SimpleSelect.onSetup;

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
  if (
    state.preprocessingEndpoint &&
    state.preprocessingResults &&
    geojson.properties.id in state.preprocessingResults
  ) {
    geojson.geometry =
      state.preprocessingResults[geojson.properties.id].geometry;
  }
  return _toDisplayFeatures.apply(this, [state, geojson, push]);
};

const _clickOnFeature = SimpleSelect.clickOnFeature;
// Inspired by mapbox-gl-draw-waypoint
SimpleSelect.clickOnFeature = function (state: any, e: any) {
  if (e.featureTarget.geometry.type !== "Point") {
    // switch to direct_select mode for polygon/line features
    this.changeMode("direct_select", {
      featureId: e.featureTarget.properties.id,
    });
  } else {
    // // call parent
    _clickOnFeature.apply(this, [state, e]);

    // prevent multi-selection for consistency with direct_select mode
    this.setSelected(e.featureTarget.properties.id);
  }
};

export default function SimpleSelectFactory(
  preprocessingEndpoint?: string,
  preprocessingResults?: { [id: string]: Feature<any> }
) {
  return {
    ...SimpleSelect,
    onSetup: function (opts: any, foo: any) {
      const state = _onSetup.apply(this, [opts]);
      state.preprocessingEndpoint = preprocessingEndpoint;
      state.preprocessingResults = preprocessingResults;
      return state;
    },
  };
}
