import { Layer } from "mapbox-gl";
import { LayerPropertyUpdater } from "./GUIStyleEditor";
import RasterFadDurationEditor from "./RasterFadeDurationEditor";
import RasterResamplingEditor from "./RasterResamplingEditor";

export default function RasterLayerEditor({
  updateLayerProperty,
  glLayer,
}: {
  updateLayerProperty: LayerPropertyUpdater;
  glLayer: Layer;
}) {
  return (
    <>
      <RasterResamplingEditor
        onChange={(value) => {
          updateLayerProperty("paint", "raster-resampling", value);
        }}
        // @ts-ignore
        value={glLayer.paint?.["raster-resampling"]}
      />
      <RasterFadDurationEditor
        onChange={(value) => {
          updateLayerProperty("paint", "raster-fade-duration", value);
        }}
        // @ts-ignore
        value={glLayer.paint?.["raster-fade-duration"]}
      />
    </>
  );
}
