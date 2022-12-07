const styles = [
  // {
  //   id: "gl-draw-polygon-kinks-label",
  //   type: "symbol",
  //   filter: [
  //     "all",
  //     // ["==", "active", "false"],
  //     // ["==", "kinks", true],
  //     ["==", "$type", "Polygon"],
  //     // ["!=", "mode", "static"],
  //   ],
  //   layout: {
  //     // text: "foo",
  //     "text-field": ["get", "user_error_message"],
  //     // "text-variable-anchor": ["top", "bottom", "left", "right"],
  //     "text-radial-offset": 0.5,
  //     "text-justify": "auto",

  //     // "icon-image": ["get", "icon"],
  //   },
  //   paint: {
  //     "text-halo-color": "white",
  //     "text-halo-width": 2,
  //   },
  // },
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
  {
    id: "gl-draw-polygon-self-intersection",
    type: "symbol",
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "meta", "self-intersection"],
    ],
    layout: {
      // "text-field": "↚",
      // "text-size": 32,
      "text-field": "✕",
      "text-size": 14,
      "text-offset": [0, 0],
      "text-allow-overlap": true,
    },
    paint: {
      "text-opacity": 0.8,
      "text-halo-color": "rgba(81.6%, 23.1%, 23.1%, 0.8)",
      // "text-color": "#fe6400",
      "text-halo-width": 1,
      "text-halo-blur": 0,
    },
  },
  {
    id: "gl-draw-polygon-preprocessing-outline",
    type: "line",
    filter: [
      "all",
      ["==", "preprocessing", "true"],
      ["==", "$type", "Polygon"],
    ],
    paint: {
      "line-color": "white",
      // "line-opacity": ["-", 1, ["get", "animationFraction"]],
      "line-offset": ["+", -3, ["*", ["get", "animationFraction"], 0.8]],
      "line-width": ["-", 3, ["*", ["get", "animationFraction"], 0.8]],
      // "line-width": 2,
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
    ],
    paint: {
      "fill-color": "white",
      // "fill-opacity": 0.1,
      "fill-opacity": ["*", 0.1, ["get", "animationFraction"]],
    },
  },
];

export default styles;
