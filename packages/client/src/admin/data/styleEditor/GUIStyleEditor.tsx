import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  ChangeEventHandler,
  ReactNode,
  RefObject,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { formatJSONCommand } from "../GLStyleEditor/formatCommand";
import {
  RasterInfo,
  GeostatsLayer,
  isRasterInfo,
} from "@seasketch/geostats-types";
import { validVisualizationTypesForGeostats } from "./visualizationTypes";
import { Layer } from "mapbox-gl";
import LayerEditor from "./LayerEditor";
import { validateGLStyleFragment } from "../GLStyleEditor/extensions/validateGLStyleFragment";

export default function GUIStyleEditor({
  editorRef,
  style,
  geostats,
}: {
  editorRef: RefObject<ReactCodeMirrorRef>;
  style: string;
  geostats: GeostatsLayer | RasterInfo;
}) {
  const validVisualizationTypes = useMemo(() => {
    return validVisualizationTypesForGeostats(geostats);
  }, [geostats]);

  const styleJSON = useMemo(() => {
    try {
      return JSON.parse(style) as Layer[];
    } catch (e) {
      return null;
    }
  }, [style]);

  const visualizationType =
    validVisualizationTypes.length > 0 ? validVisualizationTypes[0] : null;

  const { t } = useTranslation("admin:data");

  const updateLayerProperty = useCallback(
    (
      layerIndex: number,
      type: "paint" | "layout" | undefined,
      property: string,
      value: any | undefined
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
    <div>
      <EditorCard>
        {visualizationType && (
          <select
            className="bg-gray-700 text-white text-sm"
            value={visualizationType}
          >
            {validVisualizationTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}
      </EditorCard>
      {styleJSON &&
        styleJSON.map((layer, idx) => (
          <LayerEditor
            editorRef={editorRef}
            key={layer.id}
            glLayer={layer}
            geostats={geostats}
            updateLayerProperty={(type, property, value) => {
              updateLayerProperty(idx, type, property, value);
            }}
          />
        ))}
    </div>
  );
}

export type LayerPropertyUpdater = (
  type: "paint" | "layout" | undefined,
  property: string,
  value: any
) => void;

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
