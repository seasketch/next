import { Feature } from "geojson";
import DirectSelect from "./DirectSelect";
import { preprocess } from "./preprocess";

const _onSetup = DirectSelect.onSetup;
const _onStop = DirectSelect.onStop;

const Preprocessing = {
  ...DirectSelect,
};

Preprocessing.onSetup = function (opts: any) {
  // TODO: redirect to DirectSelect if there are kinks
  console.log("opts", opts);
  const state = _onSetup.apply(this, [opts]);
  const { preprocessingEndpoint, featureId, preprocessingResults } = opts;
  this.featureId = featureId;

  const feature = this.getFeature(featureId);
  if (!preprocessingEndpoint) {
    throw new Error("Preprocessing endpoint not specified");
  }
  if (!feature) {
    throw new Error("No feature for preprocessing!?");
  }

  state.preprocessingEndpoint = preprocessingEndpoint;
  state.preprocessingResults = preprocessingResults;

  preprocess(
    preprocessingEndpoint,
    feature,
    this.changeMode.bind(this),
    state.preprocessingResults
  );

  return state;
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

export default Preprocessing;

// const Preprocessing: any = {};

// Preprocessing.onSetup = function ({
//   preprocessingEndpoint,
//   featureId,
// }: {
//   preprocessingEndpoint: string;
//   featureId: string;
// }) {
//   // turn the opts into state.
//   const state = {
//     dragMoveLocation: null,
//     boxSelectStartLocation: null,
//     boxSelectElement: undefined,
//     boxSelecting: false,
//     canBoxSelect: false,
//     dragMoving: false,
//     canDragMove: false,
//     featureId: featureId,
//     endpoint: preprocessingEndpoint,
//   };

//   this.featureId = featureId;

//   const feature = this.getFeature(state.featureId);

//   if (!preprocessingEndpoint) {
//     throw new Error("Preprocessing endpoint not specified");
//   }
//   if (!feature) {
//     throw new Error("No feature for preprocessing!?");
//   }
//   fetch(preprocessingEndpoint, {
//     method: "POST",
//     headers: {
//       Accept: "application/json",
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({ feature: feature.toGeoJSON() }),
//   })
//     .then(async (response) => {
//       const data = await response.json();
//       console.log(data);
//     })
//     .catch((e) => {
//       // TODO: handle this in digitizing tools
//       throw new Error("Problem submitting shape for preprocessing");
//     });
//   return state;
// };

// Preprocessing.onStop = function () {
//   this.isAnimating = false;
// };

// Preprocessing.toDisplayFeatures = function (
//   state: any,
//   geojson: Feature,
//   display: any
// ) {
//   geojson.properties!.preprocessing = "true";
//   display(geojson);
//   this.isAnimating = true;
//   window.requestAnimationFrame(this.animate.bind(this));
// };

// const ANIMATION_INTERVAL = 10000;

// // Ideally I'd be using feature-state here but I just can't get it to work. Not
// // sure if they are fully supported within expressions
// Preprocessing.animate = function (time: number) {
//   if (this.isAnimating && this.featureId) {
//     let fraction = Math.round(time % ANIMATION_INTERVAL) / ANIMATION_INTERVAL;
//     if (this.lastFraction > 0 && fraction < this.lastFraction) {
//       this.reverse = !Boolean(this.reverse);
//     }
//     this.lastFraction = fraction;
//     if (this.reverse) {
//       fraction = 1 - fraction;
//     }
//     const source = this.map.getSource("mapbox-gl-draw-cold");
//     if (source) {
//       const fc = source._data;
//       if (fc.features.length) {
//         const feature = fc.features[0];
//         feature.properties["animationFraction"] = fraction;
//         source.setData(fc);
//         window.requestAnimationFrame(this.animate.bind(this));
//       }
//     }
//   }
// };

// export default Preprocessing;
