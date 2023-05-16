import * as MapboxDraw from "@mapbox/mapbox-gl-draw";
import CheapRuler from "cheap-ruler";
import { Feature } from "geojson";
import { scaleLinear } from "d3-scale";
import { axisBottom } from "d3-axis";
const DrawLineString = MapboxDraw.modes.draw_line_string;

const Measure = {
  ...DrawLineString,
};

export const TICK_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAECAIAAAAI1ii7AAAAAXNSR0IArs4c6QAAAMJlWElmTU0AKgAAAAgABwESAAMAAAABAAEAAAEaAAUAAAABAAAAYgEbAAUAAAABAAAAagEoAAMAAAABAAIAAAExAAIAAAARAAAAcgEyAAIAAAAUAAAAhIdpAAQAAAABAAAAmAAAAAAAAABIAAAAAQAAAEgAAAABUGl4ZWxtYXRvciAzLjkuOQAAMjAyMjowMToyNiAxNTowMTo4NwAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAABAAAAACqIXdNAAAACXBIWXMAAAsTAAALEwEAmpwYAAADp2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx0aWZmOkNvbXByZXNzaW9uPjA8L3RpZmY6Q29tcHJlc3Npb24+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjI8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjE2PC9leGlmOlBpeGVsWERpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj40PC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5QaXhlbG1hdG9yIDMuOS45PC94bXA6Q3JlYXRvclRvb2w+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDIyLTAxLTI2VDE1OjAxOjg3PC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cn9rlIsAAAAeSURBVAgdY2RgYPj//z+QJBIwEakOroxkDXCdxDIAPlMDA7T2FooAAAAASUVORK5CYII=";

export const RULER_TICK_ID = "ruler-tick";

const ruler = new CheapRuler(35.05, "kilometers");

Measure.onSetup = function (opts = {}) {
  let line, currentVertexPosition;
  let direction = "forward";
  line = this.newFeature({
    type: "Feature",
    properties: {
      __measure: true,
    },
    geometry: {
      type: "LineString",
      coordinates: [],
    },
  });
  currentVertexPosition = 0;
  this.addFeature(line);

  this.clearSelectedFeatures();
  // doubleClickZoom.disable(this);
  setTimeout(() => {
    if (!this.map || !this.map.doubleClickZoom) return;
    // Always disable here, as it's necessary in some cases.
    this.map.doubleClickZoom.disable();
  }, 0);
  this.updateUIClasses({ mouse: "add" });
  this.setActionableState({
    trash: true,
  });

  return {
    line,
    currentVertexPosition,
    direction,
  };
};

Measure.clickAnywhere = function (state: any, e: any) {
  DrawLineString.clickAnywhere.apply(this, [state, e]);
  if (state.line.coordinates.length > 2) {
    return this.changeMode("measure_direct_select", {
      featureId: state.line.id,
    });
  }
};

const _toDisplayFeatures = DrawLineString.toDisplayFeatures;

Measure.toDisplayFeatures = function (
  state: any,
  geojson: any,
  push: (feature: Feature<any>) => void
) {
  if (geojson.properties.id === state.featureId) {
    geojson.properties.__ruler = "true";
    geojson.properties.__length = ruler.lineDistance(
      geojson.geometry.coordinates
    );
    const ticks = getTicks(geojson.properties.__length);
    for (const tick of ticks) {
      push({
        type: "Feature",
        properties: {
          __ruler: true,
        },
        geometry: {
          type: "Point",
          coordinates: ruler.along(geojson.goemetry.coordinates, tick),
        },
      });
    }
  }
  _toDisplayFeatures.apply(this, [state, geojson, push]);
};

export function getTicks(distance: number): number[] {
  const scale = scaleLinear().domain([0, distance]);
  let nTicks = 10;
  if (distance <= 1) {
    return getTicks(distance * 1000);
  } else if (distance <= 10) {
    nTicks = Math.round(distance);
  } else if (distance < 100) {
    nTicks = Math.round(distance / 10);
  } else if (distance < 200) {
    nTicks = Math.round(distance / 25);
  } else if (distance < 600) {
    nTicks = Math.round(distance / 100);
  } else {
    nTicks = Math.round(distance / 200);
  }
  return scale.ticks(nTicks).filter((t) => t > 0 && t < distance);
}

export default Measure;
