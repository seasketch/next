import { Layer } from "mapbox-gl";
import { LayerPropertyDeleter, LayerPropertyUpdater } from "./GUIStyleEditor";
import RasterFadDurationEditor from "./RasterFadeDurationEditor";
import RasterResamplingEditor from "./RasterResamplingEditor";
import * as Editor from "./Editors";
import { useTranslation } from "react-i18next";
import { RasterContrastEditor } from "./RasterContrastEditor";
import { RasterSaturationEditor } from "./RasterSaturationEditor";
import { RasterBrightnessEditor } from "./RasterBrightnessEditor";
import { RasterHueRotateEditor } from "./RasterHueRotateEditor";
import { useMemo } from "react";
import { RasterInfo } from "@seasketch/geostats-types";

export default function RasterLayerEditor({
  updateLayerProperty,
  glLayer,
  deleteLayerProperties,
  rasterInfo,
}: {
  updateLayerProperty: LayerPropertyUpdater;
  glLayer: Layer;
  deleteLayerProperties: LayerPropertyDeleter;
  rasterInfo: RasterInfo;
}) {
  const { t } = useTranslation("admin:data");

  const hasAppearanceProp = useMemo(() => {
    return (
      glLayer.paint &&
      ("raster-contrast" in glLayer.paint ||
        "raster-saturation" in glLayer.paint ||
        "raster-hue-rotate" in glLayer.paint ||
        "raster-brightness-min" in glLayer.paint ||
        "raster-brightness-max" in glLayer.paint)
    );
  }, [
    glLayer.paint,
    // @ts-ignore
    glLayer.paint?.["raster-contrast"],
    // @ts-ignore
    glLayer.paint?.["raster-saturation"],
    // @ts-ignore
    glLayer.paint?.["raster-hue-rotate"],
    // @ts-ignore
    glLayer.paint?.["raster-brightness-min"],
    // @ts-ignore
    glLayer.paint?.["raster-brightness-max"],
  ]);

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
      <Editor.Header
        title={
          <span>
            {t("Appearance")}
            {hasAppearanceProp && (
              <button
                onClick={() =>
                  deleteLayerProperties([
                    { type: "paint", property: "raster-contrast" },
                    { type: "paint", property: "raster-saturation" },
                    { type: "paint", property: "raster-hue-rotate" },
                    { type: "paint", property: "raster-brightness-min" },
                    { type: "paint", property: "raster-brightness-max" },
                  ])
                }
                className="ml-2 text-sm text-indigo-300 hover:underline"
              >
                {" "}
                {t("reset")}
              </button>
            )}
          </span>
        }
      />
      <RasterContrastEditor
        // @ts-ignore
        value={glLayer.paint?.["raster-contrast"]}
        onChange={(value) => {
          updateLayerProperty("paint", "raster-contrast", value);
        }}
      />
      <RasterSaturationEditor
        // @ts-ignore
        value={glLayer.paint?.["raster-saturation"]}
        onChange={(value) => {
          updateLayerProperty("paint", "raster-saturation", value);
        }}
        rasterInfo={rasterInfo}
      />
      <RasterHueRotateEditor
        // @ts-ignore
        value={glLayer.paint?.["raster-hue-rotate"]}
        onChange={(value) => {
          updateLayerProperty("paint", "raster-hue-rotate", value);
        }}
        rasterInfo={rasterInfo}
      />
      <RasterBrightnessEditor
        // @ts-ignore
        value={glLayer.paint?.["raster-brightness-min"]}
        onChange={(value) => {
          updateLayerProperty("paint", "raster-brightness-min", value);
        }}
        property="raster-brightness-min"
        defaultValue={0}
      />
      <RasterBrightnessEditor
        // @ts-ignore
        value={glLayer.paint?.["raster-brightness-max"]}
        onChange={(value) => {
          updateLayerProperty("paint", "raster-brightness-max", value);
        }}
        property="raster-brightness-max"
        defaultValue={1}
      />
    </>
  );
}
