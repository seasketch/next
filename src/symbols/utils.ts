// @ts-ignore
import { v4 as uuid } from "uuid";

type RGBA = [number, number, number, number];

export function generateId() {
  return uuid();
}

export function createCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", w.toString());
  canvas.setAttribute("height", h.toString());
  return canvas;
}

export const rgba = (color?: RGBA) => {
  color = color || [0, 0, 0, 0];
  return `rgba(${color[0]},${color[1]},${color[2]},${color[3]})`;
};

export const colorAndOpacity = (color?: RGBA) => {
  color = color || [0, 0, 0, 0];
  return {
    color: `rgb(${color[0]},${color[1]},${color[2]})`,
    opacity: color[3] / 255,
  };
};

export const ptToPx = (pt: number) => Math.round(pt * 1.33);

const ANCHORS: { [labelPlacement: string]: string } = {
  // Note that these are essentially backwards from what you'd expect
  // details: http://resources.arcgis.com/en/help/rest/apiref/index.html?renderer.html
  // https://www.mapbox.com/mapbox-gl-js/style-spec/#layout-symbol-text-anchor
  // Label Placement Values For Point Features
  esriServerPointLabelPlacementAboveCenter: "bottom",
  esriServerPointLabelPlacementAboveLeft: "bottom-right",
  esriServerPointLabelPlacementAboveRight: "bottom-left",
  esriServerPointLabelPlacementBelowCenter: "top",
  esriServerPointLabelPlacementBelowLeft: "top-right",
  esriServerPointLabelPlacementBelowRight: "top-left",
  esriServerPointLabelPlacementCenterCenter: "center",
  esriServerPointLabelPlacementCenterLeft: "right",
  esriServerPointLabelPlacementCenterRight: "left",
  // Label Placement Values For Line Features
  // esriServerLinePlacementAboveAfter
  esriServerLinePlacementAboveAlong: "bottom",
  esriServerLinePlacementAboveBefore: "bottom-left",
  esriServerLinePlacementAboveStart: "bottom-left",
  esriServerLinePlacementAboveEnd: "bottom-right",
  esriServerLinePlacementBelowAfter: "top-right",
  esriServerLinePlacementBelowAlong: "top",
  esriServerLinePlacementBelowBefore: "top-left",
  esriServerLinePlacementBelowStart: "top-left",
  esriServerLinePlacementBelowEnd: "top-right",
  esriServerLinePlacementCenterAfter: "right",
  esriServerLinePlacementCenterAlong: "center",
  esriServerLinePlacementCenterBefore: "center-left",
  esriServerLinePlacementCenterStart: "center-left",
  esriServerLinePlacementCenterEnd: "center-right",
  // // Label Placement Values For Polygon Features
  esriServerPolygonPlacementAlwaysHorizontal: "center",
};

export const toTextAnchor = (labelPlacement: string) =>
  ANCHORS[labelPlacement] || "center";
