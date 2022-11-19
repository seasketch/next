import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { LngLatLike, Map } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { SketchGeometryType } from "../generated/graphql";
import bbox from "@turf/bbox";
import DrawLineString from "../draw/DrawLinestring";
import DrawPolygon from "../draw/DrawPolygon";
import { Feature, FeatureCollection } from "geojson";
import { useMediaQuery } from "beautiful-react-hooks";
import DrawPoint from "./DrawPoint";
import DirectSelect from "./DirectSelect";
import SimpleSelect from "./SimpleSelect";
import getKinks from "@turf/kinks";
import styles from "./styles";
import UnfinishedFeatureSelect from "./UnfinishedFeatureSelect";
import UnfinishedSimpleSelect from "./UnfinishedSimpleSelect";

function hasKinks(feature?: Feature<any>) {
  if (feature && feature.geometry.type === "Polygon") {
    return getKinks(feature).features.length > 0;
  }
  return false;
}
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
  onChange: (value: Feature<any> | null, hasKinks: boolean) => void,
  onCancelNewShape?: () => void
) {
  const [draw, setDraw] = useState<MapboxDraw | null>(null);
  const isSmall = useMediaQuery("(max-width: 767px)");
  const drawMode = glDrawMode(isSmall, geometryType);
  const [state, _setState] = useState(DigitizingState.NO_SELECTION);
  const [disabled, setDisabled] = useState(false);
  const [dragTarget, setDragTarget] =
    useState<DigitizingDragTarget | null>(null);
  const [selection, setSelection] = useState<null | Feature<any>>(null);
  const handlerState = useRef<{
    draw?: MapboxDraw;
    onChange: (value: Feature<any> | null, hasKinks: boolean) => void;
    state: DigitizingState;
  }>({ onChange, state });

  function setState(state: DigitizingState) {
    _setState(state);
    handlerState.current.state = state;
  }

  handlerState.current.onChange = onChange;

  const [selfIntersects, setSelfIntersects] = useState<boolean>(false);

  useEffect(() => {
    if (map && geometryType && !disabled && !handlerState.current.draw) {
      const draw = new MapboxDraw({
        keybindings: true,
        clickBuffer: 4,
        displayControlsDefault: true,
        controls: {},
        defaultMode: "simple_select",
        boxSelect: false,
        modes: {
          ...MapboxDraw.modes,
          draw_line_string: DrawLineString,
          draw_polygon: DrawPolygon,
          draw_point: DrawPoint,
          direct_select: DirectSelect,
          simple_select: SimpleSelect,
          unfinished_feature_select: UnfinishedFeatureSelect,
          unfinished_simple_select: UnfinishedSimpleSelect,
        },
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
              animate: true,
              duration: 500,
            }
          );
        }
      } else {
        // draw.changeMode(drawMode);
      }

      setState(DigitizingState.NO_SELECTION);

      const handlers = {
        create: function (e: any) {
          const kinks = hasKinks(e.features[0]);
          if (kinks) {
            setSelfIntersects(true);
          }
          handlerState.current.onChange(e.features[0], kinks);
        },
        update: (e: any) => {
          const mode = handlerState.current.draw?.getMode() as string;
          if (
            mode === "unfinished_feature_select" ||
            mode === "unfinished_simple_select"
          ) {
            setState(DigitizingState.UNFINISHED);
          } else {
            setState(DigitizingState.EDITING);
          }
          handlerState.current.onChange(e.features[0], selfIntersects);
        },
        drawingStarted: () => {
          setState(DigitizingState.STARTED);
        },
        canComplete: () => {
          setState(DigitizingState.CAN_COMPLETE);
        },
        // delete: function (id: string) {
        //   draw.changeMode(drawMode);
        //   setKinks(EMPTY_FEATURE_COLLECTION);
        //   handlerState.current.onChange(draw.delete(id).getAll());
        //   setState(DigitizingState.CREATE);
        // },
        modeChange: function (e: any) {
          // TODO: Escape to cancel doesn't quite work
          let newState: DigitizingState | null = null;
          switch (e.mode) {
            case "simple_select":
              if (geometryType === SketchGeometryType.Point) {
                newState = DigitizingState.NO_SELECTION;
              } else {
                // Could happen when drawing then escape key is hit
                // or when editing
                if (handlerState.current.state !== DigitizingState.EDITING) {
                  if (onCancelNewShape) {
                    onCancelNewShape();
                  }
                }
                newState = DigitizingState.NO_SELECTION;
              }

              break;
            case "direct_select":
              const selected = handlerState.current.draw?.getSelected();
              // edit of existing feature
              if (
                selected?.features.length &&
                (selected.features[0].geometry.type === "Polygon" ||
                  selected.features[0].geometry.type === "LineString")
              ) {
                newState = DigitizingState.EDITING;
              }
              break;
            case "unfinished_feature_select":
            case "unfinished_simple_select":
              newState = DigitizingState.UNFINISHED;
              break;
            // Should not need to account for draw_polygon, draw_point, etc
            // These modes are entered into via direct API calls, and thus don't
            // trigger events.
            default:
              break;
          }
          if (newState) {
            setState(newState);
          }
        },
        selectionChange: function (e: any) {
          if (!e.features?.length) {
            if (handlerState.current.state === DigitizingState.EDITING) {
              setState(DigitizingState.NO_SELECTION);
            }
            setSelection(null);
          } else {
            setSelection({ ...e.features[0] });
            if (
              geometryType === SketchGeometryType.Point &&
              handlerState.current.state === DigitizingState.NO_SELECTION
            ) {
              setState(DigitizingState.EDITING);
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
        handleKinks: function (e: { hasKinks: boolean }) {
          const mode = handlerState.current.draw?.getMode() as string;
          setSelfIntersects(e.hasKinks);
        },
      };

      map.on("draw.create", handlers.create);
      map.on("draw.update", handlers.update);
      map.on("seasketch.drawing_started", handlers.drawingStarted);
      map.on("seasketch.can_complete", handlers.canComplete);
      map.on("seasketch.drag_target", handlers.dragTarget);
      map.on("seasketch.kinks", handlers.handleKinks);
      // map.on("draw.delete", handlers.delete);
      map.on("draw.modechange", handlers.modeChange);
      map.on("draw.selectionchange", handlers.selectionChange);
      return () => {
        if (map && draw) {
          try {
            map.removeControl(draw);
          } catch (e) {
            console.warn("exception thrown when removing draw control");
          }
          handlerState.current.draw = undefined;
          setDraw(null);
          map.off("draw.create", handlers.create);
          map.off("draw.update", handlers.update);
          map.off("seasketch.drawing_started", handlers.drawingStarted);
          map.off("seasketch.drag_target", handlers.dragTarget);
          map.off("seasketch.can_complete", handlers.canComplete);
          // map.off("draw.delete", handlers.delete);
          map.off("draw.modechange", handlers.modeChange);
          map.off("draw.selectionchange", handlers.selectionChange);
        }
      };
    }
  }, [map, geometryType, disabled]);

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
        draw.changeMode("simple_select", { featureIds: [] });
        setState(DigitizingState.NO_SELECTION);
        // TODO: do we need this?
        // // This will not trigger a selection change when geometryType is point,
        // // probably because we're not change modes, so we need to set selection
        // // and state ourselves
        if (geometryType === SketchGeometryType.Point) {
          setSelection(null);
        }
      } else {
        throw new Error("draw has not been initialized");
      }
    },
    /**
     * Resets editing by destroying the current feature. Throws an exception if
     * no feature exists. Not that caller must take care to cleanup any state
     * values since the onChange handler will not be fired.
     */
    reset: () => {
      if (draw) {
        if (!initialValue) {
          throw new Error("No feature exists to delete");
        }
        draw.deleteAll();
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
    clearSelection: () => {
      handlerState.current.draw?.changeMode("simple_select");
      setState(DigitizingState.NO_SELECTION);
    },
    selectFeature: (featureId: string) => {
      if (!handlerState.current.draw) {
        console.warn("Draw not yet initialized");
        return;
      }
      if (geometryType === SketchGeometryType.Point) {
        handlerState.current.draw?.changeMode("simple_select", {
          featureIds: [featureId],
        });
        setSelection(handlerState.current.draw!.get(featureId)!);
      } else {
        handlerState.current.draw?.changeMode("direct_select", { featureId });
      }
      setState(DigitizingState.EDITING);
    },
    setUnfinished: (featureId: string) => {
      if (handlerState.current.draw) {
        if (geometryType === SketchGeometryType.Point) {
          // @ts-ignore
          handlerState.current.draw.changeMode("unfinished_simple_select", {
            featureIds: [featureId],
          });
        } else {
          // @ts-ignore
          handlerState.current.draw.changeMode("unfinished_feature_select", {
            featureId,
          });
        }
        setState(DigitizingState.UNFINISHED);
      }
    },
  };

  /**
   * If requireProps is set to true, EMPTY_PROPS and INVALID_PROPS states will
   * be active. Set property validation state using actions.setPropsValid
   * @param requireProps
   */
  function create(unfinished: boolean, isSketchWorkflow?: boolean) {
    if (handlerState.current.draw) {
      setState(DigitizingState.CREATE);
      handlerState.current.draw.changeMode(
        // @ts-ignore
        drawMode,
        {
          getNextMode: isSketchWorkflow
            ? (featureId: string) => ["simple_select"] // TODO: add preprocessing mode
            : unfinished
            ? geometryType === SketchGeometryType.Polygon
              ? (featureId: string) => [
                  "unfinished_feature_select",
                  { featureId },
                ]
              : (featureId: string) => [
                  "unfinished_simple_select",
                  { featureIds: [featureId] },
                ]
            : (featureId: string) => ["direct_select", { featureId }],
        }
      );
    }
  }

  function setCollection(collection: FeatureCollection<any>) {
    handlerState.current.draw?.set(collection);
    setState(DigitizingState.NO_SELECTION);
    setSelfIntersects(false);
    handlerState.current.draw?.changeMode("simple_select");
  }

  function resetFeature(feature: Feature<any>) {
    if (!handlerState.current.draw) {
      throw new Error(`Draw not initialized`);
    }
    const collection = handlerState.current.draw.getAll();
    const idx = collection.features.findIndex((f) => f.id === feature.id);
    if (idx === -1) {
      throw new Error(`Could not find ${idx} in draw's collection`);
    }
    const newCollection = {
      ...collection,
      features: [
        ...collection.features.slice(0, idx),
        feature,
        ...collection.features.slice(idx + 1),
      ],
    };
    handlerState.current.draw.set(newCollection);
    setSelfIntersects(false);
    // trigger check for kinks
    handlerState.current.draw.changeMode("simple_select");
    handlerState.current.draw.changeMode("direct_select", {
      featureId: feature.id as string,
    });
  }

  return {
    digitizingState: state,
    selection,
    actions,
    setCollection,
    create,
    /** Temporarily disable drawing */
    disable: () => setDisabled(true),
    /** Re-enable drawing */
    enable: () => setDisabled(false),
    dragTarget,
    selfIntersects,
    resetFeature,
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
