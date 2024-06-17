import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { Layer } from "mapbox-gl";
import {
  EditorCard,
  LayerPropertyDeleter,
  LayerPropertyUpdater,
} from "./GUIStyleEditor";
import { RefObject } from "react";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { OpacityEditor } from "./OpacityEditor";
import { ArrowLeftIcon, ArrowRightIcon } from "@radix-ui/react-icons";
import { ZoomRangeEditor } from "./ZoomRangeEditor";
import { Trans } from "react-i18next";
import RasterLayerEditor from "./RasterLayerEditor";
import { VisualizationType } from "./visualizationTypes";
require("./layer-editor.css");

const supportedTypes = ["fill", "line", "circle", "symbol", "raster"];

export default function LayerEditor({
  // layer,
  geostats,
  glLayer,
  editorRef,
  updateLayerProperty,
  deleteLayerProperties,
  type,
}: {
  // layer: FullAdminDataLayerFragment;
  geostats: GeostatsLayer | RasterInfo;
  glLayer: Layer;
  editorRef: RefObject<ReactCodeMirrorRef>;
  updateLayerProperty: LayerPropertyUpdater;
  deleteLayerProperties: LayerPropertyDeleter;
  type: VisualizationType | null;
}) {
  if (!supportedTypes.includes(glLayer.type)) {
    return null;
  } else {
    return (
      <EditorCard>
        <div className="flex flex-1 group pb-2">
          <h3 className="capitalize text-lg flex-1 space-x-2 flex">
            <span className="flex-1">{glLayer.type}</span>
            {(glLayer.minzoom !== undefined ||
              glLayer.maxzoom !== undefined) && (
              <span className="text-sm text-gray-400">
                <Trans ns="admin:data">zoom </Trans>
                {glLayer.minzoom || 0}-{glLayer.maxzoom || 22}
              </span>
            )}
          </h3>
          {glLayer.minzoom === undefined && glLayer.maxzoom === undefined && (
            <button
              title="limit to zoom range"
              onClick={() => {
                updateLayerProperty(undefined, "minzoom", 3);
                updateLayerProperty(undefined, "maxzoom", 14);
              }}
              className="flex items-center space-x-1 text-indigo-200 opacity-20 group-hover:opacity-80"
            >
              <ArrowRightIcon />
              <ArrowLeftIcon />
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          <ZoomRangeEditor
            maxzoom={glLayer.maxzoom}
            minzoom={glLayer.minzoom}
            onChange={(min, max) => {
              updateLayerProperty(undefined, "minzoom", min);
              updateLayerProperty(undefined, "maxzoom", max);
            }}
          />
          {/* TODO: zoom-dependent expression support for opacity */}
          <OpacityEditor
            value={
              // @ts-ignore
              glLayer.paint?.[`${glLayer.type}-opacity`] as number | undefined
            }
            onChange={(value: number) =>
              updateLayerProperty("paint", `${glLayer.type}-opacity`, value)
            }
          />
          {glLayer.type === "raster" && (
            <RasterLayerEditor
              glLayer={glLayer}
              updateLayerProperty={updateLayerProperty}
              deleteLayerProperties={deleteLayerProperties}
              rasterInfo={geostats as RasterInfo}
              type={type}
            />
          )}
        </div>
      </EditorCard>
    );
  }
}
