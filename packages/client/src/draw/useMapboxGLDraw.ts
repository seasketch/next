import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { GeoJSONSource, LngLatLike, Map } from "mapbox-gl";
import { useEffect, useState } from "react";
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

require("@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css");

export enum DigitizingState {
  /** User has not yet started drawing */
  BLANK,
  /** User has started drawing a non-point feature */
  STARTED,
  /**
   * Shape can be completed in a single action, such as when there are 3
   * vertices in a polygon, and the user can connect to the origin or
   * double-click to finish
   */
  CAN_COMPLETE,
  /**
   * A complete shape has been created. Similar to FINISHED, but a special state
   * that exists right after initial creation of a new feature
   */
  CREATED,
  /** Finished shape has been put into an editable state */
  EDITING,
  /** Shape is not in editing mode. */
  FINISHED,
  /** Digitizing has been disabled using disable(). Call enable() */
  DISABLED,
}

export type DigitizingDragTarget = {
  center: LngLatLike;
  currentZoom: number;
  point: { x: number; y: number };
};

const EMPTY_FEATURE_COLLECTION = {
  type: "FeatureCollection",
  features: [],
} as FeatureCollection<Point>;

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
 * @param value
 * @param onChange
 * @returns
 */
export default function useMapboxGLDraw(
  map: Map | null | undefined,
  geometryType: SketchGeometryType,
  value: Feature<any> | null,
  onChange: (value: Feature<any> | null) => void
) {
  const [draw, setDraw] = useState<MapboxDraw | null>(null);
  const isSmall = useMediaQuery("(max-width: 767px)");
  const drawMode = glDrawMode(isSmall, geometryType);
  const [state, setState] = useState(
    value ? DigitizingState.FINISHED : DigitizingState.BLANK
  );
  const [disabled, setDisabled] = useState(false);
  const [dragTarget, setDragTarget] = useState<DigitizingDragTarget | null>(
    null
  );

  const [kinks, setKinks] = useState<FeatureCollection<Point>>(
    EMPTY_FEATURE_COLLECTION
  );

  useEffect(() => {
    if (draw) {
      if (
        state !== DigitizingState.CAN_COMPLETE &&
        state !== DigitizingState.STARTED &&
        state !== DigitizingState.BLANK
      ) {
        debouncedUpdateKinks(
          draw.getAll,
          setKinks,
          state,
          draw.setFeatureProperty
        );
      }
    }
  }, [dragTarget, draw, value, drawMode, state]);

  useEffect(() => {
    if (map && geometryType && !disabled) {
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
        }),
        styles,
        userProperties: true,
      });
      setDraw(draw);
      map.addControl(draw);

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

      if (value) {
        draw.add(value);

        map.fitBounds(bbox(value) as [number, number, number, number], {
          padding: isSmall ? 100 : 200,
        });
      } else {
        draw.changeMode(drawMode);
      }

      setState(value ? DigitizingState.FINISHED : DigitizingState.BLANK);

      const handlers = {
        create: function (e: any) {
          setState(DigitizingState.CREATED);
          onChange(e.features[0]);
          // This is a stupid hack to make sure the state is set properly and
          // that the poly is turned red if there are kinks. It has something to
          // do with mapbox-gl-draw's internal render loop.
          setTimeout(() => {
            draw.changeMode("simple_select");
            setState(DigitizingState.CREATED);
          }, 60);
        },
        update: (e: any) => {
          onChange(e.features[0]);
        },
        drawingStarted: () => setState(DigitizingState.STARTED),
        canComplete: () => setState(DigitizingState.CAN_COMPLETE),
        delete: function () {
          setKinks(EMPTY_FEATURE_COLLECTION);
          draw.changeMode(drawMode);
          onChange(null);
          setState(DigitizingState.BLANK);
        },
        modeChange: function (e: any) {
          if (e.mode === "simple_select") {
            setState(DigitizingState.FINISHED);
          } else if (e.mode === "direct_select") {
            setState(DigitizingState.EDITING);
          }
        },
        selectionChange: function (e: any) {
          if (!e.features?.length) {
            if (state === DigitizingState.EDITING) {
              setState(DigitizingState.FINISHED);
            }
          }
          if (geometryType === SketchGeometryType.Point) {
            if (e.features?.length) {
              setState(DigitizingState.EDITING);
            } else {
              setState(DigitizingState.FINISHED);
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

      map.on("draw.create", handlers.create);
      map.on("draw.update", handlers.update);
      map.on("seasketch.drawing_started", handlers.drawingStarted);
      map.on("seasketch.can_complete", handlers.canComplete);
      map.on("seasketch.drag_target", handlers.dragTarget);
      map.on("draw.delete", handlers.delete);
      map.on("draw.modechange", handlers.modeChange);
      map.on("draw.selectionchange", handlers.selectionChange);
      // @ts-ignore
      window.map = map;
      return () => {
        if (map && draw) {
          map.removeControl(draw);
          map.removeSource("kinks");
          map.removeLayer("kinks-points");
          setDraw(null);
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
          setState(DigitizingState.FINISHED);
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
        if (!value) {
          throw new Error("No feature exists to delete");
        }
        draw.deleteAll();
        onChange(null);
        setState(DigitizingState.BLANK);
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
      if (draw) {
        if (!value) {
          throw new Error("No feature exists to edit");
        }
        if (
          geometryType === SketchGeometryType.Point ||
          value.geometry.type === "Point"
        ) {
          // @ts-ignore
          draw.changeMode("simple_select", {
            featureIds: [value.id],
          });
        } else {
          // @ts-ignore
          draw.changeMode("direct_select", {
            featureId: value.id,
          });
        }
        setState(DigitizingState.EDITING);
      } else {
        throw new Error("draw has not been initialized");
      }
    },
  };

  return {
    digitizingState: state,
    actions,
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
