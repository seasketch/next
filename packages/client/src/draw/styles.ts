import { RULER_TICK_ID } from "./Measure";

const styles = [
  {
    id: "gl-draw-polygon-fill-inactive-no-kinks",
    type: "fill",
    filter: [
      "all",
      ["==", "active", "false"],
      ["!=", "kinks", "true"],
      ["==", "$type", "Polygon"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    paint: {
      "fill-color": "#3bb2d0",
      "fill-outline-color": "#3bb2d0",
      "fill-opacity": 0.1,
    },
  },
  {
    id: "gl-draw-polygon-fill-inactive-kinks",
    type: "fill",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "kinks", "true"],
      ["==", "$type", "Polygon"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    paint: {
      "fill-color": "#d03b3b",
      "fill-outline-color": "#d03b3b",
      "fill-opacity": 0.2,
    },
  },
  {
    id: "gl-draw-polygon-fill-active-no-kinks",
    type: "fill",
    filter: [
      "all",
      ["==", "active", "true"],
      ["==", "$type", "Polygon"],
      ["!=", "kinks", "true"],
      ["!=", "preprocessing", "true"],
    ],
    paint: {
      "fill-color": "#fbb03b",
      "fill-outline-color": "#fbb03b",
      "fill-opacity": 0.1,
    },
  },
  {
    id: "gl-draw-polygon-fill-active-kinks",
    type: "fill",
    filter: [
      "all",
      ["==", "active", "true"],
      ["==", "$type", "Polygon"],
      ["==", "kinks", "true"],
      ["!=", "preprocessing", "true"],
    ],
    paint: {
      "fill-color": "#fb3e3b",
      "fill-outline-color": "#fb3e3b",
      "fill-opacity": 0.2,
    },
  },
  {
    id: "gl-draw-polygon-midpoint",
    type: "circle",
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "meta", "midpoint"],
      ["!=", "preprocessing", "true"],
      ["!=", "__ruler", "true"],
    ],
    paint: {
      "circle-radius": 3,
      "circle-color": "#fbb03b",
    },
  },
  {
    id: "gl-draw-polygon-stroke-inactive-no-kinks",
    type: "line",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Polygon"],
      ["!=", "kinks", "true"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#3bb2d0",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-stroke-inactive-kinks",
    type: "line",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Polygon"],
      ["==", "kinks", "true"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#d03b3b",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-stroke-active-no-kinks",
    type: "line",
    filter: [
      "all",
      ["==", "active", "true"],
      ["==", "$type", "Polygon"],
      ["!=", "kinks", "true"],
      ["!=", "preprocessing", "true"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#fbb03b",
      "line-dasharray": [0.2, 2],
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-stroke-active-kinks",
    type: "line",
    filter: [
      "all",
      ["==", "active", "true"],
      ["==", "$type", "Polygon"],
      ["==", "kinks", "true"],
      ["!=", "preprocessing", "true"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#fb863b",
      "line-dasharray": [0.2, 2],
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-line-inactive",
    type: "line",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "LineString"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#3bb2d0",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-line-active",
    type: "line",
    filter: [
      "all",
      ["==", "$type", "LineString"],
      ["==", "active", "true"],
      ["!=", "preprocessing", "true"],
      ["!=", "__ruler", "true"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#fbb03b",
      "line-dasharray": [0.2, 2],
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-ruler-active",
    type: "line",
    filter: [
      "all",
      ["==", "$type", "LineString"],
      ["==", "active", "true"],
      ["==", "__ruler", "true"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "white",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-and-line-vertex-stroke-inactive",
    type: "circle",
    filter: [
      "all",
      ["==", "meta", "vertex"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    paint: {
      "circle-radius": 5,
      "circle-color": "#fff",
    },
  },
  {
    id: "gl-draw-polygon-and-line-vertex-inactive",
    type: "circle",
    filter: [
      "all",
      ["==", "meta", "vertex"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    paint: {
      "circle-radius": 3,
      "circle-color": "#fbb03b",
    },
  },
  {
    id: "gl-draw-ruler-tick-circle",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "__tick", "true"]],
    paint: {
      "circle-radius": 2.5,
      "circle-color": "#fff",
    },
  },
  {
    id: "gl-draw-ruler-tick-inner-circle",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "__tick", "true"]],
    paint: {
      "circle-radius": 1,
      "circle-color": "black",
    },
  },
  {
    id: "gl-draw-ruler-tick-label",
    type: "symbol",
    filter: ["all", ["==", "$type", "Point"], ["==", "__tick", "true"]],
    layout: {
      "text-field": ["get", "distance"],
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-size": 12,
      "text-anchor": "left",
      "text-justify": "left",
      "icon-allow-overlap": true,
      "text-offset": [1, 0],

      // "text-allow-overlap": true,
      "icon-ignore-placement": true,
      // "text-ignore-placement": true,
      "symbol-placement": "point",
      // "text-rotation": ["get", "bearing"],
    },
    paint: {
      "text-halo-color": "rgba(255, 255, 255, 1)",
      "text-halo-width": 1,
      "text-halo-blur": 1,
    },
  },
  // {
  //   id: "gl-draw-ruler-distance-label",
  //   type: "symbol",
  //   filter: ["all", ["==", "__ruler", "true"], ["==", "$type", "LineString"]],
  //   layout: {
  //     "text-field": ["get", "distanceLabel"],
  //     "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
  //     "text-size": 16,
  //     "text-anchor": "top",
  //     // "text-offset": [0, 0],
  //     "text-justify": "center",
  //     "icon-allow-overlap": true,
  //     "text-allow-overlap": true,
  //     "icon-ignore-placement": true,
  //     // "text-ignore-placement": true,
  //     "symbol-placement": "line",
  //     // "symbol-spacing": 1024,
  //   },
  //   paint: {
  //     "text-halo-color": "rgba(255, 255, 255, 1)",
  //     "text-halo-width": 2,
  //     "text-halo-blur": 1,
  //   },
  // },
  {
    id: "gl-draw-ruler-distance-label",
    type: "symbol",
    filter: ["all", ["==", "__rulerEnd", "true"], ["==", "$type", "Point"]],
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-size": 16,
      "text-anchor": "right",
      "text-offset": [-1.5, 0],
      "text-justify": "right",
      "icon-allow-overlap": true,
      "text-allow-overlap": true,
      "icon-ignore-placement": true,
      // "text-ignore-placement": true,
      // "symbol-placement": "",
      // "symbol-spacing": 1024,
    },
    paint: {
      "text-halo-color": "rgba(255, 255, 255, 1)",
      "text-halo-width": 2,
      "text-halo-blur": 1,
    },
  },
  {
    id: "gl-draw-point-point-stroke-inactive",
    type: "circle",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Point"],
      ["==", "meta", "feature"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    paint: {
      "circle-radius": 5,
      "circle-opacity": 1,
      "circle-color": "#fff",
    },
  },
  {
    id: "gl-draw-point-inactive",
    type: "circle",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Point"],
      ["==", "meta", "feature"],
      ["!=", "mode", "static"],
      ["!=", "preprocessing", "true"],
    ],
    paint: {
      "circle-radius": 3,
      "circle-color": "#3bb2d0",
    },
  },
  {
    id: "gl-draw-point-stroke-active",
    type: "circle",
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "active", "true"],
      ["!=", "meta", "midpoint"],
    ],
    paint: {
      "circle-radius": 7,
      "circle-color": "#fff",
    },
  },
  {
    id: "gl-draw-point-active",
    type: "circle",
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["!=", "meta", "midpoint"],
      ["==", "active", "true"],
    ],
    paint: {
      "circle-radius": 5,
      "circle-color": "#fbb03b",
    },
  },
  {
    id: "gl-draw-polygon-fill-static",
    type: "fill",
    filter: ["all", ["==", "mode", "static"], ["==", "$type", "Polygon"]],
    paint: {
      "fill-color": "#404040",
      "fill-outline-color": "#404040",
      "fill-opacity": 0.1,
    },
  },
  {
    id: "gl-draw-polygon-stroke-static",
    type: "line",
    filter: ["all", ["==", "mode", "static"], ["==", "$type", "Polygon"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#404040",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-line-static",
    type: "line",
    filter: ["all", ["==", "mode", "static"], ["==", "$type", "LineString"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#404040",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-point-static",
    type: "circle",
    filter: ["all", ["==", "mode", "static"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 5,
      "circle-color": "#404040",
    },
  },
  // Booting up gl-draw when sketching from my plans with this on always causes
  // an exception. Further, it can block cursor changes when hovering over a
  // vertex to finish a shape. Note sure why so I'm going to have to disable
  // this. -cburt TODO: fix...
  // {
  //   id: "gl-draw-polygon-self-intersection",
  //   type: "symbol",
  //   filter: [
  //     "all",
  //     ["has", "meta"],
  //     ["==", ["get", "meta"], "self-intersection"],
  //   ],
  //   layout: {
  //     "text-field": "✕",
  //     "text-size": 14,
  //     "text-offset": [0, 0],
  //     "text-allow-overlap": true,
  //   },
  //   paint: {
  //     "text-opacity": 0.8,
  //     "text-halo-color": "rgba(81.6%, 23.1%, 23.1%, 0.8)",
  //     "text-halo-width": 1,
  //     "text-halo-blur": 0,
  //   },
  // },
  {
    id: "gl-draw-polygon-preprocessing-outline",
    type: "line",
    filter: [
      "all",
      ["==", "preprocessing", "true"],
      ["==", "$type", "Polygon"],
      ["has", "animationFraction"],
    ],
    paint: {
      "line-color": "white",
      "line-width": ["-", 3, ["*", ["get", "animationFraction"], 0.8]],
      "line-dasharray": [1, 2, 1],
    },
  },
  {
    id: "gl-draw-polygon-preprocessing-fill",
    type: "fill",
    filter: [
      "all",
      ["==", "preprocessing", "true"],
      ["==", "$type", "Polygon"],
      ["has", "animationFraction"],
    ],
    paint: {
      "fill-color": "white",
      "fill-opacity": ["*", 0.1, ["get", "animationFraction"]],
    },
  },
];

export default styles;
