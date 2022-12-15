import { Feature, Geometry } from "geojson";
import { Dispatch, SetStateAction } from "react";
import DS from "./DirectSelect";
import { preprocess } from "./preprocess";

const DirectSelect = DS();
const _onSetup = DirectSelect.onSetup;
const _onStop = DirectSelect.onStop;

const Preprocessing = {
  ...DirectSelect,
};

Preprocessing.clickNoTarget = function (state: any, e: any) {
  // clear coordinate selection but don't allow change of mode
  state.selectedCoordPaths = [];
  this.clearSelectedCoordinates();
  state.feature.changed();
  return false;
};

Preprocessing.clickInactive = function () {
  // do nothing. don't allow switching away
  // this.changeMode(Constants.modes.SIMPLE_SELECT);
};

Preprocessing.toDisplayFeatures = function (
  state: any,
  geojson: Feature,
  display: any
) {
  if (geojson.properties!.id === state.featureId) {
    geojson.properties!.preprocessing = "true";
    geojson.properties!.animationFraction = 0;
  }
  if (state.featureId === geojson.properties!.id) {
    geojson.properties!.preprocessing = "true";
    geojson.properties!.animationFraction = 0;
  }
  geojson.properties!.active = "false";
  display(geojson);
  this.fireActionable(state);
  this.isAnimating = true;
  window.requestAnimationFrame(this.animate.bind(this));
};

Preprocessing.onMouseMove = function (state: any, e: any) {
  const result = DirectSelect.onMouseMove.apply(this, [state, e]);
  if (
    e.featureTarget?.properties?.active === "false" &&
    e.featureTarget?.properties?.preprocessing === "true"
  ) {
    this.updateUIClasses({ mouse: "wait" });
  }
  return result;
};

Preprocessing.onStop = function () {
  this.isAnimating = false;
  if (_onStop) {
    _onStop.apply(this);
  }
};

const ANIMATION_INTERVAL = 10000;

// Ideally I'd be using feature-state here but I just can't get it to work. Not
// sure if they are fully supported within expressions
Preprocessing.animate = function (time: number) {
  if (this.isAnimating && this.featureId) {
    let fraction = Math.round(time % ANIMATION_INTERVAL) / ANIMATION_INTERVAL;
    if (this.lastFraction > 0 && fraction < this.lastFraction) {
      this.reverse = !Boolean(this.reverse);
    }
    this.lastFraction = fraction;
    if (this.reverse) {
      fraction = 1 - fraction;
    }
    const source = this.map.getSource("mapbox-gl-draw-cold");
    if (source) {
      const fc = source._data;
      for (const feature of fc.features) {
        if (feature.properties!.id === this.featureId) {
          feature.properties["animationFraction"] = fraction;
          source.setData(fc);
          window.requestAnimationFrame(this.animate.bind(this));
        }
      }
    }
  }
};

export default function PreproccessingFactory(
  setPreprocessingError: Dispatch<SetStateAction<string | null>>,
  preprocessingEndpoint?: string,
  preprocessingResults?: { [id: string]: Feature<any> },
  onPreprocessedGeometry?: (geometry: Geometry) => void
) {
  return {
    ...Preprocessing,
    onSetup: function (opts: any) {
      const state = _onSetup.apply(this, [opts]);
      state.preprocessingEndpoint = preprocessingEndpoint;
      state.preprocessingResults = preprocessingResults;
      state.onPreprocessedGeometry = onPreprocessedGeometry;
      state.setPreprocessingError = setPreprocessingError;
      if (!state.preprocessingEndpoint) {
        throw new Error("Preprocessing endpoint not specified");
      }
      if (!state.setPreprocessingError) {
        throw new Error("setPreprocessingError parameter is required");
      }
      const { featureId } = opts;
      this.featureId = featureId;
      const feature = this.getFeature(featureId);
      if (!feature) {
        throw new Error("No feature for preprocessing!?");
      }
      setPreprocessingError(null);
      preprocess(
        state.preprocessingEndpoint,
        feature,
        this.changeMode.bind(this),
        state.preprocessingResults,
        state.onPreprocessedGeometry
      ).catch((e: Error) => {
        setPreprocessingError(e.message);
        this.changeMode("direct_select", { ...opts, preprocessingError: true });
      });

      return state;
    },
  };
}
