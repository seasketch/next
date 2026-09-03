import { CameraOptions } from "mapbox-gl";
import {
  applySurveyMapCamera,
  surveyMapCameraKey,
} from "./surveyContextualMapCamera";

test("surveyMapCameraKey is empty when camera is missing", () => {
  expect(surveyMapCameraKey(undefined)).toBe("");
  expect(surveyMapCameraKey(null)).toBe("");
});

test("surveyMapCameraKey treats equivalent cameras as the same page extent", () => {
  const asObject: CameraOptions = {
    center: { lng: 163.02, lat: 5.33 },
    zoom: 14.66,
    pitch: 0,
    bearing: 0,
  };
  const sameValues: CameraOptions = {
    center: { lng: 163.02, lat: 5.33 },
    zoom: 14.66,
    pitch: 0,
    bearing: 0,
  };
  expect(surveyMapCameraKey(asObject)).toBe(surveyMapCameraKey(sameValues));
});

test("surveyMapCameraKey changes when zoom or center changes", () => {
  const lelu: CameraOptions = {
    center: { lng: 163.022, lat: 5.331 },
    zoom: 14.66,
    pitch: 0,
    bearing: 0,
  };
  const offCoast: CameraOptions = {
    center: { lng: 162.973, lat: 5.318 },
    zoom: 10.54,
    pitch: 0,
    bearing: 0,
  };
  expect(surveyMapCameraKey(lelu)).not.toBe(surveyMapCameraKey(offCoast));
});

test("surveyMapCameraKey includes pitch 0 so a tilted previous page is distinct", () => {
  const flat: CameraOptions = {
    center: { lng: 163, lat: 5 },
    zoom: 12,
    pitch: 0,
    bearing: 0,
  };
  const tilted: CameraOptions = {
    center: { lng: 163, lat: 5 },
    zoom: 12,
    pitch: 60,
    bearing: 0,
  };
  expect(surveyMapCameraKey(flat)).not.toBe(surveyMapCameraKey(tilted));
});

test("applySurveyMapCamera no-ops without a map or camera", () => {
  const jumpTo = jest.fn();
  applySurveyMapCamera({ jumpTo }, undefined);
  applySurveyMapCamera(undefined, {
    center: { lng: 1, lat: 2 },
    zoom: 8,
  });
  expect(jumpTo).not.toHaveBeenCalled();
});

test("applySurveyMapCamera jumps including pitch and bearing 0", () => {
  const jumpTo = jest.fn();
  const camera: CameraOptions = {
    center: { lng: 162.97, lat: 5.32 },
    zoom: 10.5,
    pitch: 0,
    bearing: 0,
  };
  applySurveyMapCamera({ jumpTo }, camera);
  expect(jumpTo).toHaveBeenCalledWith({
    center: camera.center,
    zoom: 10.5,
    pitch: 0,
    bearing: 0,
  });
});
