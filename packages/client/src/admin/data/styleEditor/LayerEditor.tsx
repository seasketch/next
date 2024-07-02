import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { Layer } from "mapbox-gl";
import { LayerPropertyDeleter, LayerPropertyUpdater } from "./GUIStyleEditor";
import { RefObject } from "react";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import RasterLayerEditor from "./RasterLayerEditor";
import { VisualizationType } from "./visualizationTypes";

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
      <>
        {/* <div className="space-y-0.5"> */}
        {glLayer.type === "raster" && glLayer.paint && (
          <RasterLayerEditor
            glLayer={glLayer}
            updateLayerProperty={updateLayerProperty}
            deleteLayerProperties={deleteLayerProperties}
            rasterInfo={geostats as RasterInfo}
            type={type}
          />
        )}
        {/* </div> */}
      </>
    );
  }
}
