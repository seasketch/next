import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { formatJSONCommand } from "../GLStyleEditor/formatCommand";
import {
  RasterInfo,
  GeostatsLayer,
  isRasterInfo,
  isLegacyGeostatsLayer,
} from "@seasketch/geostats-types";
import {
  VisualizationType,
  convertToVisualizationType,
  determineVisualizationType,
  validVisualizationTypesForGeostats,
} from "./visualizationTypes";
import { FillLayer, Layer } from "mapbox-gl";
import { MapManagerContext, idForLayer } from "../../../dataLayers/MapContextManager";
import { validateGLStyleFragment } from "../GLStyleEditor/extensions/validateGLStyleFragment";
import * as Editors from "./Editors";
import EditorForVisualizationType from "./EditorForVisualizationType";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import VisualizationTypeControl from "./VisualizationTypeControl";
import useDialog from "../../../components/useDialog";
import { useDebouncedFn } from "beautiful-react-hooks";
import Warning from "../../../components/Warning";
require("./layer-editor.css");

export type PropertyRef = {
  type: "paint" | "layout" | undefined;
  property: string;
};

export default function GUIStyleEditor({
  editorRef,
  style,
  geostats,
  layerId,
  undoRedoCounter,
}: {
  editorRef: RefObject<ReactCodeMirrorRef>;
  style: string;
  geostats: GeostatsLayer | RasterInfo;
  layerId?: number;
  undoRedoCounter?: number;
}) {
  const [previousSettings, setPreviousSettings] = useState<{
    [setting: string]: any;
  }>({});
  const supportedTypes = useMemo(() => {
    return validVisualizationTypesForGeostats(geostats);
  }, [geostats]);

  const { manager } = useContext(MapManagerContext);

  const [styleJSON, setStyleJSON] = useState(JSON.parse(style) as Layer[]);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (view) {
      const doc = view.state.doc.toString();
      setStyleJSON(JSON.parse(doc) as Layer[]);
    }
  }, [editorRef.current?.view, setStyleJSON, undoRedoCounter]);

  const visualizationType = useMemo(
    () => determineVisualizationType(geostats, supportedTypes, styleJSON),
    [geostats, supportedTypes, styleJSON]
  );

  const { alert } = useDialog();

  const updateEditor = useDebouncedFn(
    (style: string) => {
      editorRef.current?.view?.dispatch({
        changes: {
          from: 0,
          to: editorRef.current.view!.state.doc.length,
          insert: style,
        },
      });
      formatJSONCommand(editorRef.current?.view!);
    },
    100,
    {},
    [editorRef.current?.view]
  );

  const setVisualizationType = useCallback(
    (type: VisualizationType) => {
      try {
        const newLayers = convertToVisualizationType(geostats, type, styleJSON);
        if (newLayers) {
          // _setVisualizationType(type);
          const errors = validateGLStyleFragment(
            newLayers,
            isRasterInfo(geostats) ? "raster" : "vector"
          );
          if (errors.length > 0) {
            console.error(errors);
            throw new Error(errors.map((e) => e.message).join("\n"));
          }

          // @ts-ignore
          setStyleJSON([...newLayers]);
          editorRef.current?.view?.dispatch({
            changes: {
              from: 0,
              to: editorRef.current.view!.state.doc.length,
              insert: JSON.stringify(newLayers),
            },
          });
          formatJSONCommand(editorRef.current?.view!);
        }
      } catch (e) {
        console.error(e);
        alert("An error occurred while changing to this visualization type", {
          description: e.message,
        });
      }
    },
    [setStyleJSON, editorRef, styleJSON, geostats]
  );

  const { t } = useTranslation("admin:data");

  const deleteLayerProperties = useCallback(
    (layerIndex: number, properties: PropertyRef[]) => {
      if (styleJSON === null) {
        throw new Error("Style JSON is null");
      }
      if (layerIndex >= styleJSON.length) {
        throw new Error("Layer index out of bounds");
      }
      const layer = styleJSON[layerIndex];
      properties.forEach(({ type, property }) => {
        if (type && layer[type]) {
          // @ts-ignore
          delete layer[type][property];
        } else {
          // @ts-ignore
          delete layer[property];
        }
      });

      if (manager?.map && layerId) {
        for (const { type, property } of properties) {
          try {
            const map = manager.map;
            const id = idForLayer({ id: layerId, dataSourceId: 0 }, layerIndex);
            const layer = map.getLayer(id);
            if (layer) {
              // using the layer id, update the style in the map
              try {
                if (type === "layout") {
                  map.setLayoutProperty(id, property, undefined);
                } else if (type === "paint") {
                  map.setPaintProperty(id, property, undefined);
                } else if (property === "maxzoom") {
                  map.setLayerZoomRange(
                    id,
                    (layer as FillLayer).minzoom || 0,
                    24
                  );
                } else if (property === "minzoom") {
                  map.setLayerZoomRange(
                    id,
                    0,
                    (layer as FillLayer).maxzoom || 24
                  );
                }
              } catch (e) {}
            }
          } catch (e) {
            // do nothing. map might not be loaded
          }
        }
      }

      setStyleJSON([...styleJSON]);
      updateEditor(JSON.stringify(styleJSON));
    },
    [editorRef, styleJSON, manager?.map, layerId]
  );

  const updateLayerProperty = useCallback(
    (
      layerIndex: number,
      type: "paint" | "layout" | "filter" | undefined,
      property: string | undefined,
      value: any | undefined,
      metadata?: { [key: string]: any }
    ) => {
      if (styleJSON === null) {
        throw new Error("Style JSON is null");
      }
      if (layerIndex >= styleJSON.length) {
        throw new Error("Layer index out of bounds");
      }
      const layer = styleJSON[layerIndex];
      if (type && !layer[type]) {
        if (type !== "filter") {
          layer[type] = {};
        }
      }
      if (!layer) {
        console.error(styleJSON, layerIndex, layer);
        throw new Error(`Layer not found. ${layerIndex}`);
      }
      if (property !== undefined) {
        if (type) {
          if (value === undefined) {
            // @ts-ignore
            delete layer[type][property];
          } else {
            // @ts-ignore
            layer[type][property] = value;
          }
        } else {
          if (value === undefined) {
            // @ts-ignore
            delete layer[property];
          } else {
            // @ts-ignore
            layer[property] = value;
          }
        }
        // const errors = validateGLStyleFragment(
        //   styleJSON,
        //   isRasterInfo(geostats) ? "raster" : "vector"
        // );
        // if (errors.length > 0) {
        //   throw new Error(errors.join("\n"));
        // }
        if (manager?.map && layerId) {
          try {
            const map = manager.map;
            const id = idForLayer({ id: layerId, dataSourceId: 0 }, layerIndex);
            const layer = map.getLayer(id);
            if (layer) {
              // using the layer id, update the style in the map
              try {
                if (type === "layout") {
                  map.setLayoutProperty(id, property, value);
                } else if (type === "paint") {
                  map.setPaintProperty(id, property, value);
                } else if (property === "maxzoom") {
                  map.setLayerZoomRange(
                    id,
                    (layer as FillLayer).minzoom || 0,
                    value || 24
                  );
                } else if (property === "minzoom") {
                  map.setLayerZoomRange(
                    id,
                    value || 0,
                    (layer as FillLayer).maxzoom || 24
                  );
                }
              } catch (e) {}
            }
          } catch (e) {
            // do nothing. map might not be loaded
          }
        }
      } else if (type === "filter") {
        if (value === undefined) {
          delete layer.filter;
        } else {
          layer.filter = value;
        }
        if (manager?.map && layerId) {
          const map = manager.map;
          const id = idForLayer({ id: layerId, dataSourceId: 0 }, layerIndex);
          const layer = map.getLayer(id);
          if (layer) {
            // using the layer id, update the style in the map
            try {
              map.setFilter(id, value);
            } catch (e) {
              // do nothing
            }
          }
        }
      }
      if (metadata) {
        for (const key in metadata) {
          layer.metadata = layer.metadata || {};
          if (metadata[key] === undefined) {
            delete layer.metadata[key];
          } else {
            layer.metadata[key] = metadata[key];
          }
        }
        layer.metadata = { ...layer.metadata };
      }
      styleJSON[layerIndex] = { ...layer };
      setStyleJSON([...styleJSON]);
      const style = JSON.stringify(styleJSON);
      updateEditor(style);
    },
    [styleJSON, updateEditor, setStyleJSON, layerId, manager?.map]
  );

  const addLayer = useCallback(
    (layerIndex: number, layer: SeaSketchGlLayer) => {
      if (styleJSON === null) {
        throw new Error("Style JSON is null");
      }
      if (layerIndex > styleJSON.length) {
        throw new Error("Layer index out of bounds");
      }
      styleJSON.splice(layerIndex, 0, layer as Layer);
      setStyleJSON([...styleJSON]);
      editorRef.current?.view?.dispatch({
        changes: {
          from: 0,
          to: editorRef.current.view!.state.doc.length,
          insert: JSON.stringify(styleJSON),
        },
      });
      formatJSONCommand(editorRef.current?.view!);
    },
    [styleJSON, editorRef]
  );

  const removeLayer = useCallback(
    (layerIndex: number) => {
      if (styleJSON === null) {
        throw new Error("Style JSON is null");
      }
      if (layerIndex >= styleJSON.length) {
        throw new Error("Layer index out of bounds");
      }
      styleJSON.splice(layerIndex, 1);
      setStyleJSON([...styleJSON]);
      updateEditor(JSON.stringify(styleJSON));
      // editorRef.current?.view?.dispatch({
      //   changes: {
      //     from: 0,
      //     to: editorRef.current.view!.state.doc.length,
      //     insert: JSON.stringify(styleJSON),
      //   },
      // });
      // formatJSONCommand(editorRef.current?.view!);
    },
    [styleJSON, editorRef]
  );

  if (
    !isRasterInfo(geostats) &&
    geostats.geometry !== "Polygon" &&
    geostats.geometry !== "MultiPolygon" &&
    geostats.geometry !== "Point" &&
    geostats.geometry !== "MultiPoint"
  ) {
    return (
      <Editors.Card>
        <Warning level="info">
          {t(
            "The new cartography tools are only available for raster and polygon data sources at this time. Please check again soon for added support for point and line data."
          )}
        </Warning>
      </Editors.Card>
    );
  }

  if (supportedTypes.length === 0) {
    return (
      <Editors.Card>
        {t(
          "Visualization options could not be determined for this data source. Please switch to the Code Editor to make changes to this style."
        )}
      </Editors.Card>
    );
  }

  if (!isRasterInfo(geostats) && isLegacyGeostatsLayer(geostats)) {
    return (
      <Editors.Card>
        <Warning level="info">
          {t(
            "This older data source was uploaded before the introduction of the new cartography tools and is incompatible. Please use the code editor, or re-upload this data in order to enable these new tools."
          )}
          <br />
          <br />
          {t(
            "You can download the data and upload a new copy from the Data Source tab. Older data sources will be upgraded for the new system using an automated process in the future."
          )}
        </Warning>
      </Editors.Card>
    );
  }

  return (
    <div className="overflow-y-auto">
      <Editors.GUIEditorContext.Provider
        value={{
          previousSettings,
          setPreviousSettings,
          updateLayer: updateLayerProperty,
          deleteLayerProperties,
          geostats,
          glLayers: styleJSON,
          type: visualizationType || undefined,
          t,
          addLayer,
          removeLayer,
          supportedTypes,
          setVisualizationType,
        }}
      >
        {(!visualizationType ||
          !supportedTypes.includes(visualizationType)) && (
          <div className="px-4">
            <div className="mt-5">
              <VisualizationTypeControl />
            </div>
          </div>
        )}
        {styleJSON && visualizationType && (
          <EditorForVisualizationType type={visualizationType} />
        )}
      </Editors.GUIEditorContext.Provider>
    </div>
  );
}

export type LayerPropertyUpdater = (
  type: "paint" | "layout" | undefined,
  property: string | undefined,
  value: any | undefined,
  metadata?: { [key: string]: any }
) => void;

export type LayerUpdater = (
  idx: number,
  type: "paint" | "layout" | "filter" | undefined,
  property: string | undefined,
  value: any | undefined,
  metadata?: Editors.SeaSketchLayerMetadata
) => void;

export type LayerPropertyDeleter = (properties: PropertyRef[]) => void;

// export type LayerStyleUpdater = (
//   layer: Layer,
//   updates: {
//     paint: Partial<Layer["paint"]>;
//     layout: Partial<Layer["layout"]>;
//   }
// ) => void;
