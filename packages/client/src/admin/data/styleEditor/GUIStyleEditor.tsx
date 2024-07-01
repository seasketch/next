import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { formatJSONCommand } from "../GLStyleEditor/formatCommand";
import {
  RasterInfo,
  GeostatsLayer,
  isRasterInfo,
} from "@seasketch/geostats-types";
import {
  VisualizationType,
  convertToVisualizationType,
  determineVisualizationType,
  validVisualizationTypesForGeostats,
} from "./visualizationTypes";
import { Layer } from "mapbox-gl";
import LayerEditor from "./LayerEditor";
import { MapContext, idForLayer } from "../../../dataLayers/MapContextManager";
import { validateGLStyleFragment } from "../GLStyleEditor/extensions/validateGLStyleFragment";
import * as Editors from "./Editors";

type PropertyRef = {
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
  const validVisualizationTypes = useMemo(() => {
    return validVisualizationTypesForGeostats(geostats);
  }, [geostats]);

  const mapContext = useContext(MapContext);

  const [styleJSON, setStyleJSON] = useState(JSON.parse(style) as Layer[]);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (view) {
      const doc = view.state.doc.toString();
      setStyleJSON(JSON.parse(doc) as Layer[]);
      const visualizationType = determineVisualizationType(
        geostats,
        validVisualizationTypes,
        JSON.parse(doc) as Layer[]
      );
      if (visualizationType) {
        _setVisualizationType(visualizationType);
      }
    }
  }, [editorRef.current?.view, setStyleJSON, undoRedoCounter]);

  const [visualizationType, _setVisualizationType] =
    useState<VisualizationType | null>(
      determineVisualizationType(geostats, validVisualizationTypes, styleJSON)
    );

  const setVisualizationType = useCallback(
    (type: VisualizationType) => {
      const newLayers = convertToVisualizationType(geostats, type, styleJSON);
      if (newLayers) {
        _setVisualizationType(type);
        const errors = validateGLStyleFragment(
          newLayers,
          isRasterInfo(geostats) ? "raster" : "vector"
        );
        if (errors.length > 0) {
          throw new Error(errors.join("\n"));
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
    [editorRef, styleJSON]
  );

  const updateLayerProperty = useCallback(
    (
      layerIndex: number,
      type: "paint" | "layout" | undefined,
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
        layer[type] = {};
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
        if (
          mapContext.manager?.map &&
          layerId &&
          mapContext.manager.map.loaded()
        ) {
          const map = mapContext.manager.map;
          const id = idForLayer({ id: layerId, dataSourceId: 0 }, layerIndex);
          // using the layer id, update the style in the map
          if (type === "layout") {
            map.setLayoutProperty(id, property, value);
          } else if (type === "paint") {
            map.setPaintProperty(id, property, value);
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
      editorRef.current?.view?.dispatch({
        changes: {
          from: 0,
          to: editorRef.current.view!.state.doc.length,
          insert: JSON.stringify(styleJSON),
        },
      });
      formatJSONCommand(editorRef.current?.view!);
    },
    [styleJSON, editorRef, setStyleJSON, layerId, mapContext.manager?.map]
  );

  if (validVisualizationTypes.length === 0) {
    return (
      <EditorCard>
        {t(
          "Visualization options could not be determined for this data source. Please switch to the Code Editor to make changes to this style."
        )}
      </EditorCard>
    );
  }

  return (
    <div className="overflow-y-auto">
      <EditorCard>
        <Editors.Root>
          <Editors.Label title={t("Visualization Type")} />
          <Editors.Control>
            <select
              className="bg-gray-700 text-white text-sm"
              value={visualizationType || "Unknown"}
              onChange={(e) => {
                setVisualizationType(e.target.value as VisualizationType);
              }}
            >
              {validVisualizationTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
              {(!visualizationType ||
                !validVisualizationTypes.includes(visualizationType)) && (
                <option value="Unknown">{t("Unknown")}</option>
              )}
            </select>
          </Editors.Control>
        </Editors.Root>
        {(!visualizationType ||
          !validVisualizationTypes.includes(visualizationType)) && (
          <p className="pt-4 text-gray-200">
            <Trans ns="admin:data">
              The style for this layer could not be recognized using any of
              SeaSketch's templates. Please choose a visualization type if you
              would like to use the graphical style editor.
            </Trans>
          </p>
        )}
      </EditorCard>
      {styleJSON &&
        styleJSON.map((layer, idx) => (
          <LayerEditor
            type={visualizationType}
            editorRef={editorRef}
            key={idx + layer.type}
            glLayer={layer}
            geostats={geostats}
            updateLayerProperty={(type, property, value, metadata) => {
              updateLayerProperty(idx, type, property, value, metadata);
            }}
            deleteLayerProperties={(properties) => {
              deleteLayerProperties(idx, properties);
            }}
          />
        ))}
    </div>
  );
}

export type LayerPropertyUpdater = (
  type: "paint" | "layout" | undefined,
  property: string | undefined,
  value: any | undefined,
  metadata?: { [key: string]: any }
) => void;

export type LayerPropertyDeleter = (properties: PropertyRef[]) => void;

export function EditorCard({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`LayerEditor m-3 p-4 bg-gray-700 bg-opacity-20 border border-white border-opacity-5 text-white text-sm rounded ${className}`}
    >
      {children}
    </div>
  );
}
