import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { GeoJSONSource, LngLatLike, Map } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { SketchGeometryType } from "../generated/graphql";
import bbox from "@turf/bbox";
import * as MapboxDrawWaypoint from "mapbox-gl-draw-waypoint";
import DrawLineString from "../draw/DrawLinestring";
import DrawPolygon from "../draw/DrawPolygon";
import { Feature, FeatureCollection, Point } from "geojson";
import { useMediaQuery } from "beautiful-react-hooks";
import DrawPoint from "./DrawPoint";
import DirectSelect from "./DirectSelect";
import SimpleSelect from "./SimpleSelect";
import getKinks from "@turf/kinks";
import styles from "./styles";
import debounce from "lodash.debounce";
import UnfinishedFeatureSelect from "./UnfinishedFeatureSelect";

require("@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css");

export enum DigitizingState {
  /** User has not yet started drawing */
  CREATE,
  /** User has started drawing a non-point feature */
  STARTED,
  /**
   * Shape can be completed in a single action, such as when there are 3
   * vertices in a polygon, and the user can connect to the origin or
   * double-click to finish
   */
  CAN_COMPLETE,
  /** Finished shape has been put into an editable state */
  EDITING,
  /** Shape is not in editing mode. */
  NO_SELECTION,
  /** Digitizing has been disabled using disable(). Call enable() */
  DISABLED,
  /**
   * Digitizing may be complete, but required attributes are not filled out.
   * This state is usefull to integrate with property editing components. Call
   * create(unfinished:boolean) with unfinished=true to instruct this hook to
   * keep the shape in an editable state until finished() is called. A shape
   * can be put back into an unfinished state by calling invalidate(). Note that
   * the current mode must be direct-select.
   */
  UNFINISHED,
}

export type DigitizingDragTarget = {
  center: LngLatLike;
  currentZoom: number;
  point: { x: number; y: number };
};

export const EMPTY_FEATURE_COLLECTION = {
  type: "FeatureCollection",
  features: [],
} as FeatureCollection<any>;

const debouncedUpdateKinks = debounce(
  (
    getFeatures: () => FeatureCollection<any>,
    setKinks: (value: FeatureCollection<Point>) => void,
    state: DigitizingState,
    setFeatureProperty: (
      featureId: string,
      property: string,
      value: any
    ) => void
  ) => {
    const collection = getFeatures();
    if (collection.features.length > 0) {
      const feature = collection.features[0];
      if (feature.geometry.type === "Polygon") {
        const kinks = getKinks(feature);
        setFeatureProperty(
          feature.id as string,
          "kinks",
          (kinks.features.length > 0).toString()
        );
        setKinks(kinks);
      }
    }
  },
  32,
  { maxWait: 100, leading: false }
);

/**
 *
 * @param map
 * @param geometryType
 * @param initialValue
 * @param onChange
 * @returns
 */
export default function useMapboxGLDraw(
  map: Map | null | undefined,
  geometryType: SketchGeometryType,
  initialValue: FeatureCollection<any> | null,
  onChange: (value: Feature<any> | null) => void
) {
  const [draw, setDraw] = useState<MapboxDraw | null>(null);
  const isSmall = useMediaQuery("(max-width: 767px)");
  const drawMode = glDrawMode(isSmall, geometryType);
  const [state, setState] = useState(DigitizingState.NO_SELECTION);
  const [disabled, setDisabled] = useState(false);
  const [dragTarget, setDragTarget] = useState<DigitizingDragTarget | null>(
    null
  );
  const [selection, setSelection] = useState<null | Feature<any>>(null);
  const handlerState = useRef<{
    draw?: MapboxDraw;
    onChange: (value: Feature<any> | null) => void;
  }>({ onChange });

  handlerState.current.onChange = onChange;

  const [kinks, setKinks] = useState<FeatureCollection<Point>>(
    EMPTY_FEATURE_COLLECTION
  );

  useEffect(() => {
    if (handlerState.current.draw) {
      if (
        state !== DigitizingState.CAN_COMPLETE &&
        state !== DigitizingState.STARTED &&
        state !== DigitizingState.CREATE
      ) {
        debouncedUpdateKinks(
          handlerState.current.draw.getAll,
          setKinks,
          state,
          handlerState.current.draw.setFeatureProperty
        );
      }
    }
  }, [dragTarget, draw, initialValue, drawMode, state]);

  useEffect(() => {
    if (map && geometryType && !disabled && !handlerState.current.draw) {
      console.log("useMapboxGLDraw:setup");
      const draw = new MapboxDraw({
        keybindings: true,
        clickBuffer: 4,
        displayControlsDefault: true,
        controls: {},
        defaultMode: "simple_select",
        modes: MapboxDrawWaypoint.enable({
          ...MapboxDraw.modes,
          draw_line_string: DrawLineString,
          draw_polygon: DrawPolygon,
          draw_point: DrawPoint,
          direct_select: DirectSelect,
          simple_select: SimpleSelect,
          unfinished_feature_select: UnfinishedFeatureSelect,
        }),
        styles,
        userProperties: true,
      });
      // @ts-ignore
      window.draw = draw;
      handlerState.current.draw = draw;
      setDraw(draw);

      map.addControl(draw);

      if (initialValue) {
        draw.set(initialValue);
        if (initialValue.features.length) {
          map.fitBounds(
            bbox(initialValue) as [number, number, number, number],
            {
              padding: isSmall ? 100 : 200,
            }
          );
        }
      } else {
        // draw.changeMode(drawMode);
      }

      setState(DigitizingState.NO_SELECTION);

      const handlers = {
        addLayers: function () {
          map.addSource("kinks", {
            type: "geojson",
            data: kinks,
          });

          map.addLayer({
            id: "kinks-symbol",
            type: "symbol",
            source: "kinks",
            layout: {
              "text-field": "↚",
              "text-size": 32,
              "text-offset": [0, -0.1],
              "text-allow-overlap": true,
            },
            paint: {
              "text-opacity": 0.8,
              "text-halo-color": "rgba(81.6%, 23.1%, 23.1%, 0.8)",
              "text-halo-width": 1,
              "text-halo-blur": 0,
            },
          });
        },
        create: function (e: any) {
          handlerState.current.onChange(e.features[0]);
        },
        update: (e: any) => {
          handlerState.current.onChange(e.features[0]);
        },
        drawingStarted: () => {
          setState(DigitizingState.STARTED);
        },
        canComplete: () => {
          setState(DigitizingState.CAN_COMPLETE);
        },
        delete: function (id: string) {
          draw.changeMode(drawMode);
          setKinks(EMPTY_FEATURE_COLLECTION);
          handlerState.current.onChange(draw.delete(id).getAll());
          setState(DigitizingState.CREATE);
        },
        modeChange: function (e: any) {
          console.log("change mode", e);
          if (e.mode === "simple_select") {
            setKinks(EMPTY_FEATURE_COLLECTION);
            setState(DigitizingState.NO_SELECTION);
          } else if (e.mode === "direct_select") {
            setKinks(EMPTY_FEATURE_COLLECTION);
            setState(DigitizingState.EDITING);
          }
        },
        selectionChange: function (e: any) {
          if (!e.features?.length) {
            if (state === DigitizingState.EDITING) {
              setState(DigitizingState.NO_SELECTION);
            }
            setSelection(null);
          } else {
            setSelection({ ...e.features[0] });
          }
          if (geometryType === SketchGeometryType.Point) {
            if (e.features?.length) {
              setState(DigitizingState.EDITING);
            } else {
              setState(DigitizingState.NO_SELECTION);
            }
          }
        },
        dragTarget: function (e: any) {
          if (e.coordinates) {
            setDragTarget({
              center: e.coordinates,
              currentZoom: map.getZoom(),
              point: e.point,
            });
          } else {
            setDragTarget(null);
          }
        },
      };

      if (map.isStyleLoaded()) {
        handlers.addLayers();
      } else {
        map.on("load", handlers.addLayers);
      }
      map.on("draw.create", handlers.create);
      map.on("draw.update", handlers.update);
      map.on("seasketch.drawing_started", handlers.drawingStarted);
      map.on("seasketch.can_complete", handlers.canComplete);
      map.on("seasketch.drag_target", handlers.dragTarget);
      map.on("draw.delete", handlers.delete);
      map.on("draw.modechange", handlers.modeChange);
      map.on("draw.selectionchange", handlers.selectionChange);
      return () => {
        console.log("useMapboxGLDraw:cleanup", map, draw);
        if (map && draw) {
          if (map.getSource("kinks")) {
            map.removeSource("kinks");
          }
          if (map.getLayer("kinks-points")) {
            map.removeLayer("kinks-points");
          }
          map.removeControl(draw);
          handlerState.current.draw = undefined;
          setDraw(null);
          map.off("load", handlers.addLayers);
          map.off("draw.create", handlers.create);
          map.off("draw.update", handlers.update);
          map.off("seasketch.drawing_started", handlers.drawingStarted);
          map.off("seasketch.drag_target", handlers.dragTarget);
          map.off("seasketch.can_complete", handlers.canComplete);
          map.off("draw.delete", handlers.delete);
          map.off("draw.modechange", handlers.modeChange);
          map.off("draw.selectionchange", handlers.selectionChange);
        }
      };
    }
  }, [map, geometryType, disabled]);

  useEffect(() => {
    if (map) {
      try {
        const source = map.getSource("kinks") as GeoJSONSource;
        source.setData(kinks);
      } catch (e) {}
    }
  }, [kinks, map]);

  useEffect(() => {
    if (disabled) {
      setState(DigitizingState.DISABLED);
    }
  }, [disabled]);

  const actions = {
    /**
     * If digitizing is in state EDITING or CAN_COMPLETE, this function will end
     * editing. Users can always click away from a shape being edited, or
     * double-click the last point of a polygon they are creating, but this
     * action allows for another affordance like a "Finish Shape" button to be
     * provided.
     */
    finishEditing: () => {
      if (draw) {
        if (
          state === DigitizingState.EDITING ||
          state === DigitizingState.CAN_COMPLETE
        ) {
          draw.changeMode("simple_select", { featureIds: [] });
          setState(DigitizingState.NO_SELECTION);
        } else {
          throw new Error(`Cannot finish editing from state ${state}`);
        }
      } else {
        throw new Error("draw has not been initialized");
      }
    },
    /**
     * Resets editing by destroying the current feature. Throws an exception if
     * no feature exists.
     */
    reset: () => {
      if (draw) {
        if (!initialValue) {
          throw new Error("No feature exists to delete");
        }
        draw.deleteAll();
        handlerState.current.onChange(null);
        setState(DigitizingState.CREATE);
        // @ts-ignore
        draw.changeMode(drawMode);
      } else {
        throw new Error("draw has not been initialized");
      }
    },
    /**
     * Puts the current feature into editing mode.
     */
    edit: () => {
      if (handlerState.current.draw) {
        const selected = handlerState.current.draw.getSelected();
        if (!selected.features.length) {
          throw new Error("No feature is selected");
        }
        const feature = selected.features[0];
        if (
          geometryType === SketchGeometryType.Point ||
          feature.geometry.type === "Point"
        ) {
          // @ts-ignore
          draw.changeMode("simple_select", {
            featureIds: [feature.id],
          });
        } else {
          // @ts-ignore
          draw.changeMode("direct_select", {
            featureId: feature.id,
          });
        }
        setState(DigitizingState.EDITING);
      } else {
        throw new Error("draw has not been initialized");
      }
    },
  };

  /**
   * If requireProps is set to true, EMPTY_PROPS and INVALID_PROPS states will
   * be active. Set property validation state using actions.setPropsValid
   * @param requireProps
   */
  function create(unfinished: boolean) {
    if (handlerState.current.draw) {
      setState(DigitizingState.CREATE);
      handlerState.current.draw.changeMode(
        // @ts-ignore
        drawMode,
        {
          getNextMode: unfinished
            ? (featureId: string) => [
                "unfinished_feature_select",
                { featureId },
              ]
            : (featureId: string) => ["direct_select", { featureId }],
        }
      );
    }
  }
  return {
    digitizingState: state,
    selection,
    actions,
    create,
    /** Temporarily disable drawing */
    disable: () => setDisabled(true),
    /** Re-enable drawing */
    enable: () => setDisabled(false),
    dragTarget,
    kinks,
  };
}

function glDrawMode(
  isSmall: boolean,
  geometryType: SketchGeometryType
): "draw_line_string" | "draw_point" | "draw_polygon" {
  if (geometryType === SketchGeometryType.Point) {
    return "draw_point";
  } else if (geometryType === SketchGeometryType.Linestring) {
    return "draw_line_string";
  } else if (geometryType === SketchGeometryType.Polygon) {
    return "draw_polygon";
  }
  throw new Error("Not implemented");
}
