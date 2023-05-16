import { Feature, LineString } from "geojson";
import _DirectSelect from "./DirectSelect";
import CheapRuler, { Point } from "cheap-ruler";
import { getTicks } from "./Measure";

const DirectSelect = _DirectSelect() as any;
console.log(DirectSelect);
const _onSetup = DirectSelect.onSetup;

const MeasureDirectSelect = {
  ...DirectSelect,
};

const ruler = new CheapRuler(35.05, "kilometers");
MeasureDirectSelect.onSetup = function (opts: any) {
  const state = _onSetup.apply(this, [opts]);
  this.numberFormatter = new Intl.NumberFormat("en-US", {
    style: "decimal",
    unit: "kilometer",
    maximumFractionDigits: 2,
  });
  return state;
};

MeasureDirectSelect.clickNoTarget = function (state: any, e: any) {
  // clear coordinate selection but don't allow change of mode
  state.selectedCoordPaths = [];
  this.clearSelectedCoordinates();
  state.feature.changed();
  return false;
};

MeasureDirectSelect.clickInactive = function () {
  // do nothing. don't allow switching away
  // this.changeMode(Constants.modes.SIMPLE_SELECT);
};

MeasureDirectSelect.onMouseMove = function (state: any, e: any) {
  const result = DirectSelect.onMouseMove.apply(this, [state, e]);
  if (
    e.featureTarget?.properties?.active === "false" &&
    e.featureTarget?.properties?.meta === "feature"
  ) {
    this.updateUIClasses({ mouse: "not-allowed" });
  }
  return result;
};

const _toDisplayFeatures = DirectSelect.toDisplayFeatures;

MeasureDirectSelect.toDisplayFeatures = function (
  state: any,
  geojson: Feature<LineString, any>,
  push: (feature: Feature<any>) => void
) {
  if (geojson.properties.id === state.featureId) {
    geojson.properties.__ruler = "true";
    geojson.properties.__length = ruler.lineDistance(
      // @ts-ignore
      geojson.geometry.coordinates
    );
    const meters = geojson.properties.__length < 1;
    const ticks = getTicks(geojson.properties.__length);
    let prev = geojson.geometry.coordinates[0];
    for (let tick of ticks) {
      const position = ruler.along(
        // @ts-ignore
        geojson.geometry.coordinates,
        meters ? tick / 1000 : tick
      );
      push({
        type: "Feature",
        properties: {
          __tick: "true",
          distance: tick.toString(),
          // eslint-disable-next-line i18next/no-literal-string
          label: `${meters ? tick * 1000 : tick} ${meters ? "m" : "km"}`,
          parent: state.featureId,
        },
        geometry: {
          type: "Point",
          coordinates: position,
        },
      });
      prev = position;
    }
    push({
      type: "Feature",
      properties: {
        __rulerEnd: "true",
        distance: geojson.properties.__length.toString(),
        // eslint-disable-next-line i18next/no-literal-string
        label: `${
          meters
            ? this.numberFormatter.format(geojson.properties.__length * 1000)
            : this.numberFormatter.format(geojson.properties.__length)
        } ${meters ? "m" : "km"}`,
        parent: state.featureId,
      },
      geometry: {
        type: "Point",
        coordinates:
          geojson.geometry.coordinates[geojson.geometry.coordinates.length - 1],
      },
    });
  }
  _toDisplayFeatures.apply(this, [state, geojson, push]);
};

export default MeasureDirectSelect;
