import { EventEmitter } from "eventemitter3";
import { FeatureCollection, LineString, Point } from "geojson";
import debounce from "lodash.debounce";
import mapboxgl, { GeoJSONSource, Map } from "mapbox-gl";
import length from "@turf/length";
import MapContextManager, {
  DigitizingLockState,
  DigitizingLockStateChangeEventPayload,
  DigitizingLockStateChangeEventType,
  MapContext,
} from "./dataLayers/MapContextManager";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import useLocalStorage from "./useLocalStorage";
import { useMediaQuery } from "beautiful-react-hooks";

// ID generator (featureId++)
let featureId = 0;

const emptyFeatureCollection = () =>
  ({
    type: "FeatureCollection",
    features: [],
  } as FeatureCollection);

export const MeasureControlLockId = "MeasureControl";

export const measureLayers: mapboxgl.AnyLayer[] = [
  {
    id: "__measure-lines",
    type: "line",
    source: "__measure-lines",
    filter: ["in", "$type", "LineString"],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#555",
      "line-width": 5,
    },
  },
  {
    id: "__measure-lines-inner",
    type: "line",
    source: "__measure-lines",
    filter: ["in", "$type", "LineString"],
    layout: {
      "line-cap": "square",
      "line-join": "round",
    },
    paint: {
      "line-color": "white",
      "line-width": 3,
      "line-dasharray": [3, 5, 3],
    },
  },
  {
    id: "__measure-points-halo",
    type: "circle",
    source: "__measure-points",
    filter: ["in", "$type", "Point"],
    paint: {
      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "halo"], false],
        9,
        1,
      ],
      "circle-color": [
        "case",
        ["boolean", ["feature-state", "halo"], false],
        "rgba(255, 255, 255, 0.4)",
        "rgba(255, 255, 255, 0)",
      ],
      "circle-radius-transition": {
        duration: 500,
      },
      "circle-color-transition": {
        duration: 500,
      },
    },
  },
  {
    id: "__measure-points",
    type: "circle",
    source: "__measure-points",
    filter: ["in", "$type", "Point"],
    paint: {
      "circle-radius": 4,
      "circle-color": "#555",
    },
  },
  {
    id: "__measure-points-inner",
    type: "circle",
    source: "__measure-points",
    filter: ["in", "$type", "Point"],
    paint: {
      "circle-radius": 2,
      "circle-color": "white",
    },
  },
];

// copy __measure-points-* to __measure-cursor-*
for (const layer of measureLayers) {
  if (
    layer.id.startsWith("__measure-points") &&
    layer.id !== "__measure-points-halo"
  ) {
    measureLayers.push({
      ...layer,
      id: layer.id.replace("__measure-points", "__measure-cursor"),
      // @ts-ignore
      source: "__measure-cursor",
    });
  }
}

export type MeasureState =
  | "drawing"
  | "editing"
  | "dragging"
  | "paused"
  | "disabled";

export type MeasureControlState = {
  state: MeasureState;
  /* in kilometers */
  length: number;
};

class MeasureControl extends EventEmitter {
  private map: Map;
  private points = emptyFeatureCollection() as FeatureCollection<Point>;
  private lines = emptyFeatureCollection() as FeatureCollection<LineString>;
  private cursor = emptyFeatureCollection() as FeatureCollection<Point>;

  private state: MeasureState = "drawing";
  private draggedPointIndex: number = 0;
  private isDestroyed = false;
  private length = 0;
  private mapContextManager: MapContextManager;

  constructor(mapContextManager: MapContextManager) {
    super();
    if (!mapContextManager.map) {
      throw new Error("Map not ready.");
    }
    this.map = mapContextManager.map;
    this.mapContextManager = mapContextManager;
    this.mapContextManager.on(
      DigitizingLockStateChangeEventType,
      this.onDigitizingLockStateChange
    );

    this.map.once("remove", this.destroy);
    this.state = "disabled";
    this.map.once("load", () => {
      this.addSourcesAndLayers();
      this.addEventListeners(this.map);
      this.setState("disabled");
    });
  }

  /** Un-pause measurement if no longer locked */
  private onDigitizingLockStateChange = (
    e: DigitizingLockStateChangeEventPayload
  ) => {
    if (
      e.digitizingLockState === DigitizingLockState.Free &&
      this.state === "paused"
    ) {
      this.setState("editing");
    }
  };

  private addSourcesAndLayers() {
    const sources = this.getSources();
    for (const id in sources) {
      this.map.addSource(id, sources[id]);
    }
    for (const layer of measureLayers) {
      this.map.addLayer(layer);
    }
  }

  private onData = (e: mapboxgl.MapDataEvent) => {
    // Catch style events and make sure sources and layers are always added and on top
    // Inspired by mapbox-gl-draw
    // https://github.com/mapbox/mapbox-gl-draw/blob/main/src/events.js#L157
    if (e.dataType === "style") {
      const sources = this.getSources();
      for (const id in sources) {
        if (!this.map.getSource(id)) {
          this.addSourcesAndLayers();
          return;
        }
      }
      for (const layer of measureLayers) {
        if (!this.map.getLayer(layer.id)) {
          this.addSourcesAndLayers();
          return;
        }
      }
    }
  };

  private addEventListeners(map: Map) {
    map.on("data", this.onData);
    map.on("click", this.onClick);
    map.on("mouseover", "__measure-points", this.onMouseOverPoint);
    map.on("mouseout", "__measure-points", this.onMouseOutPoint);
    map.on("mousedown", "__measure-points", this.onMouseDownPoint);
    map.on("mousemove", this.onMouseMove);
    map.on("mouseup", this.onMouseUp);
    document.body.addEventListener("keydown", this.onKeyDown);
  }

  private removeEventListeners(map: Map) {
    map.off("data", this.onData);
    map.off("click", this.onClick);
    map.off("mouseover", "__measure-points", this.onMouseOverPoint);
    map.off("mouseout", "__measure-points", this.onMouseOutPoint);
    map.off("mousedown", "__measure-points", this.onMouseDownPoint);
    map.off("mousemove", this.onMouseMove);
    map.off("mouseup", this.onMouseUp);
    document.body.removeEventListener("keydown", this.onKeyDown);
  }

  private async setState(state: MeasureState) {
    this.state = state;

    const hasLock = this.mapContextManager.hasLock(MeasureControlLockId);
    if (state !== "disabled" && !hasLock) {
      const lock = await this.mapContextManager.requestDigitizingLock(
        MeasureControlLockId,
        state === "dragging" || state === "drawing"
          ? DigitizingLockState.CursorActive
          : DigitizingLockState.Editing,
        async (requester) => {
          if (this.state === "editing") {
            this.setState("paused");
          } else if (this.state === "drawing" || this.onMouseDownOnPoint) {
            return false;
          } else {
            this.disable();
          }
          return true;
        }
      );
      if (!lock) {
        return;
      }
    }

    if (state === "drawing") {
      this.setMouseCursor("default");
      this.map.doubleClickZoom.disable();
    } else if (state === "editing") {
      this.setMouseCursor("default");
    } else if (state === "dragging") {
      this.setMouseCursor("grabbing");
    } else if (state === "disabled") {
      this.length = 0;
      this.points.features = [];
      this.clearCursor();
      const source = this.map.getSource("__measure-points") as GeoJSONSource;
      source.setData(this.points);
      this.updateLineString();
    }

    this.emit("update", {
      length: this.length,
      state: this.state,
    });
  }

  disable() {
    if (this.mapContextManager.hasLock(MeasureControlLockId)) {
      this.mapContextManager.releaseDigitizingLock(MeasureControlLockId);
    }
    this.setState("disabled");
  }

  /**
   * Teardown method to remove all layers, sources, and event listeners from the
   * map. Call before discarding this instance of MeasureControl.
   */
  destroy = () => {
    if (this.map) {
      for (const layer of measureLayers) {
        this.map.removeLayer(layer.id);
      }
      const sources = this.getSources();
      for (const id in sources) {
        if (this.map.getSource(id)) {
          this.map.removeSource(id);
        }
      }
      this.map.doubleClickZoom.enable();
      // unregister all event handlers
      this.removeEventListeners(this.map);
    }
    this.isDestroyed = true;
  };

  onKeyDown = (e: KeyboardEvent) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    if (e.key === "Escape" && this.state === "drawing") {
      this.stopEditing();
    }
  };

  stopEditing = () => {
    // update the points source
    const source = this.map.getSource("__measure-points") as GeoJSONSource;
    source.setData(this.points);
    // clear the cursor source
    this.clearCursor();
    this.clearHalos();
    // update the linestring
    this.updateLineString();
    this.setState("editing");
    setTimeout(() => {
      this.map.doubleClickZoom.enable();
    }, 200);
    if (this.points.features.length === 1) {
      this.reset();
    }
  };

  onMouseOverPoint = async (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    if (this.state === "disabled" || this.state === "dragging") {
      return;
    }
    if (this.state === "drawing") {
      if (e.features.length > 0) {
        const feature = e.features[0];
        if (this.points.features.length > 1) {
          const lastPoint =
            this.points.features[this.points.features.length - 1];
          if (lastPoint.id === feature.id) {
            this.handleIsOverLastPoint(lastPoint.id! as number);
            return;
          }
        }
      }
    } else if (this.state === "editing") {
      this.cursorOverRuler = false;
      if (e.features.length > 0) {
        // Lock before disabling dragpan so that mapbox-gl-draw isn't active and re-enabling dragpan
        const lock = await this.mapContextManager.requestDigitizingLock(
          MeasureControlLockId,
          DigitizingLockState.CursorActive,
          async (requester) => {
            // False because this will only be active while moused-over a point.
            return false;
          }
        );
        if (lock) {
          this.map.dragPan.disable();
          // change cursor to pointer
          this.setMouseCursor("grab");
          const index = this.points.features.findIndex(
            (point) => point.id === e.features[0].id
          );
          if (this.draggedPointIndex > -1) {
            this.clearHalos();
          }
          this.draggedPointIndex = index;
          this.map.setFeatureState(
            {
              source: "__measure-points",
              id: e.features[0].id,
            },
            {
              halo: true,
            }
          );
        } else {
          // console.log("lock request denied");
        }
      }
    }
  };

  private isOverLastPoint = false;

  private handleIsOverLastPoint = (id: number) => {
    this.isOverLastPoint = true;
    // add new last point click handler
    // change cursor to pointer
    this.setMouseCursor("pointer");
    // remove cursor from points source
    this.clearCursor();
    // redraw linestring
    this.updateLineString();
    // add feature-state hover to last point
    this.map.setFeatureState(
      {
        source: "__measure-points",
        id,
      },
      {
        halo: true,
      }
    );
  };

  onClick = (e: mapboxgl.MapMouseEvent) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    if (this.state === "drawing") {
      // Check if on last point
      if (this.isOverLastPoint) {
        this.stopEditing();
      } else {
        const coords = e.lngLat.toArray() as [number, number];
        if (this.points.features.length >= 1) {
          // Set to true until mousemove sets otherwise
          this.isOverLastPoint = true;
        }
        this.addPoint(coords);
        this.updateLineString();
      }
    } else if (this.state === "editing") {
    }
  };

  private clearCursor = () => {
    const cursorSource = this.map.getSource(
      "__measure-cursor"
    ) as GeoJSONSource;
    this.cursor.features = [];
    cursorSource.setData(this.cursor);
  };

  private clearHalos = () => {
    // loop through all points, remove halo feature-state
    for (const point of this.points.features) {
      this.map.setFeatureState(
        {
          source: "__measure-points",
          id: point.id,
        },
        {
          halo: false,
        }
      );
    }
  };

  private setMouseCursor(type: "default" | "pointer" | "grab" | "grabbing") {
    this.map.getCanvas().style.setProperty("cursor", type);
  }

  private cursorOverRuler = false;
  onMouseOutPoint = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }

    if (this.state === "drawing") {
      if (this.isOverLastPoint) {
        this.isOverLastPoint = false;
        // remove feature-state hover from last point
        this.clearHalos();
      } else {
        this.clearHalos();
      }
    } else if (this.state === "editing") {
      this.mapContextManager.releaseDigitizingLock(MeasureControlLockId);
      this.map.dragPan.enable();
      this.setMouseCursor("default");

      this.clearHalos();
      this.draggedPointIndex = -1;
    } else if (this.state === "dragging") {
      // this.clearHalos();
    }
    this.cursorOverRuler = false;
  };

  reset = () => {
    this.draggedPointIndex = -1;
    this.isOverLastPoint = false;
    this.points.features = [];
    const source = this.map.getSource("__measure-points") as GeoJSONSource;
    source.setData(this.points);
    this.length = 0;
    this.updateLineString();
    this.setState("drawing");
  };

  updatePointCoordinates(index: number, coords: number[]) {
    const point = this.points.features[index];
    if (point) {
      point.geometry.coordinates = coords;
      this.updateLineString();
      const source = this.map.getSource("__measure-points") as GeoJSONSource;
      source.setData(this.points);
    }
  }

  private onMouseDownOnPoint = false;

  onMouseDownPoint = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    this.onMouseDownOnPoint = true;
    if (this.state === "editing" && this.draggedPointIndex > -1) {
      this.map.dragPan.disable();
      this.setState("dragging");
    }
  };

  onMouseUp = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    this.onMouseDownOnPoint = false;
    if (this.state === "dragging") {
      this.setState("editing");
      this.draggedPointIndex = -1;
    }
  };

  handleDragPoint = (e: any) => {
    if (this.draggedPointIndex === -1) {
      throw new Error("draggedPointIndex is -1");
    }
    this.updatePointCoordinates(this.draggedPointIndex, e.lngLat.toArray());
  };

  /**
   * Mousemove handler for drawing mode. Updates the cursor position.
   */
  handleCursorMove = (e: any) => {
    if (this.isOverLastPoint) {
      const lastPoint = this.points.features[this.points.features.length - 1];
      // query the point layer to see if you really are over last point
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: ["__measure-points"],
      });
      if (features.length > 0 && lastPoint.id === features[0].id) {
        return;
      } else {
        this.isOverLastPoint = false;
        // remove feature-state hover from last point
        this.map.setFeatureState(
          {
            source: "__measure-points",
            id: lastPoint.id,
          },
          {
            halo: false,
          }
        );
      }
    }
    const coords = e.lngLat.toArray();
    const source = this.map.getSource("__measure-cursor") as GeoJSONSource;
    // set new cursor
    this.cursor.features = [
      {
        type: "Feature",
        id: featureId++,
        geometry: {
          type: "Point",
          coordinates: coords,
        },
        properties: {},
      },
    ];
    if (source) {
      source.setData(this.cursor);
      // update the line source
      this.updateLineString();
    }
  };

  onMouseMove = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    if (this.state === "drawing") {
      // update cursor
      this.handleCursorMove(e);
    } else if (this.state === "dragging") {
      this.handleDragPoint(e);
    }
  };

  /**
   * Updates the linestring source with a line generated from the current points
   * source FeatureCollection.
   */
  updateLineString() {
    const points = this.points.features.map((f) => f.geometry.coordinates);
    if (this.cursor.features.length > 0) {
      points.push(this.cursor.features[0].geometry.coordinates);
    }
    this.lines = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: points,
          },
          properties: {},
        },
      ],
    };
    const source = this.map.getSource("__measure-lines") as GeoJSONSource;
    source.setData(this.lines);
    if (this.lines.features[0].geometry.coordinates.length > 1) {
      this.updateLength();
    }
  }

  updateLength = debounce(
    () => {
      const line = this.lines.features[0];
      let km = 0;
      if (line && line.geometry.coordinates.length > 1) {
        km = length(line, { units: "kilometers" });
      }
      this.length = km;
      this.emit("update", {
        length: km,
        state: this.state,
      });
    },
    20,
    {
      maxWait: 100,
    }
  );

  /**
   * Adds a new point to the points source and updates the map.
   */
  addPoint(coords: [number, number]) {
    const id = featureId++;
    this.points.features.push({
      type: "Feature",
      id,
      geometry: {
        type: "Point",
        coordinates: coords,
      },
      properties: {},
    });
    const source = this.map.getSource("__measure-points") as GeoJSONSource;
    source.setData(this.points);
  }

  /**
   * Returns mapbox-gl sources that can be added to the map. Used by
   * MapContextManager.getComputedStyle.
   * @returns a map of sources to be added to the map
   */
  getSources() {
    const sources: { [id: string]: mapboxgl.AnySourceData } = {};
    sources["__measure-points"] = {
      type: "geojson",
      data: this.points,
    };
    sources["__measure-lines"] = {
      type: "geojson",
      data: this.lines,
    };
    sources["__measure-cursor"] = {
      type: "geojson",
      data: this.cursor,
    };
    return sources;
  }
}

export default MeasureControl;

interface MeasureControlContextValue extends MeasureControlState {
  reset: () => void;
  close: () => void;
}

const NotImplemented = () => {
  throw new Error("Not implemented");
};

const defaultValue: MeasureControlContextValue = {
  length: 0,
  state: "disabled",
  reset: NotImplemented,
  close: NotImplemented,
};

export const MeasureControlContext =
  createContext<MeasureControlContextValue>(defaultValue);

export function MeasureControlContextProvider(props: { children: ReactNode }) {
  // get MapContextManager from context
  const mapContext = useContext(MapContext);
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    if (mapContext.manager?.map) {
      const measureControl = new MeasureControl(mapContext.manager);
      setValue({
        length: 0,
        state: "disabled",
        reset: measureControl.reset,
        close: () => {
          measureControl.disable();
        },
      });
      measureControl.on("update", (state) => {
        setValue({
          ...state,
          reset: measureControl.reset,
          close: () => {
            measureControl.disable();
          },
        });
      });
      return () => {
        measureControl.destroy();
      };
    }
  }, [mapContext.manager, mapContext.manager?.map]);

  return (
    <MeasureControlContext.Provider value={value}>
      {props.children}
    </MeasureControlContext.Provider>
  );
}

const formatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export function MeasurementToolsOverlay({
  placement,
}: {
  placement:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-right-homepage";
}) {
  const mapContext = useContext(MapContext);
  const measureContext = useContext(MeasureControlContext);
  const { t } = useTranslation("homepage");

  const mouseHoverNotAvailable = useMediaQuery("(any-hover: none)");

  const units: {
    id: string;
    label: string;
    conversion: (km: number) => number;
  }[] = useMemo(
    () => [
      {
        id: "km",
        label: t("kilometers"),
        conversion: (km) => km,
      },
      {
        id: "mi",
        label: t("miles"),
        conversion: (km) => km * 0.621371,
      },
      {
        id: "nm",
        label: t("nautical miles"),
        conversion: (km) => km * 0.539957,
      },
      {
        id: "m",
        label: t("meters"),
        conversion: (km) => km * 1000,
      },
    ],
    [t]
  );

  const [selectedUnitValue, setSelectedUnitValue] = useLocalStorage(
    "measure-unit",
    units[0].id
  );
  const isSmall = useMediaQuery("(max-width: 767px)");

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === selectedUnitValue) || units[0],
    [units, selectedUnitValue]
  );

  if (!measureContext || measureContext.state === "disabled") {
    return null;
  }

  const { state, length } = measureContext;

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.5,
          }}
          animate={{
            opacity: state === "paused" ? 0.8 : 1,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            scale: 0,
          }}
          transition={{
            duration: 0.15,
          }}
          className={`${
            placement === "top-right"
              ? isSmall
                ? "right-20 top-5"
                : "right-24 mr-1 top-5"
              : placement === "top-right-homepage"
              ? "right-14 top-2.5"
              : "left-20 top-5"
          } ${
            state === "paused" ? "pointer-events-none" : "pointer-events-auto"
          } absolute z-10 bg-white shadow rounded border w-72`}
        >
          <div className="flex mt-2">
            <div className="text-xl font-semibold flex-1 truncate text-center mx-5">
              {formatter.format(selectedUnit.conversion(length || 0))}{" "}
              {selectedUnit.label}
            </div>
          </div>

          <p className="px-2 py-1 text-center text-xs mb-1">
            {state === "drawing" &&
              length === 0 &&
              (mouseHoverNotAvailable
                ? t("Tap the map to start measuring.")
                : t("Click on the map to start measuring."))}
            {state === "drawing" &&
              Boolean(length) &&
              length > 0 &&
              (mouseHoverNotAvailable
                ? t(
                    "Tap again to measure a path, or use the buttons below to finish or start over."
                  )
                : t(
                    "Double-click to finish measuring or click to draw a path."
                  ))}
            {(state === "editing" || state === "dragging") &&
              (mouseHoverNotAvailable
                ? t("")
                : t("Drag points to modify the measured distance."))}
          </p>
          <div className="flex h-12 items-center gap-1 bg-gray-50 p-2 border-t">
            <select
              onChange={(e) => {
                setSelectedUnitValue(e.target.value || units[0].id);
              }}
              value={selectedUnit.id}
              className="px-1 py-0.5 text-sm pr-8 rounded border-gray-200 bg-white"
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                measureContext.reset();
              }}
              disabled={state === "drawing"}
              className={buttonClass}
            >
              {t("reset")}
            </button>
            <button
              onClick={() => {
                measureContext.close();
              }}
              className={buttonClass}
            >
              {mouseHoverNotAvailable ? t("finish") : t("close")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const buttonClass = "border text-sm px-1 py-0.5 rounded bg-white";
