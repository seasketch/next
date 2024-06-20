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
import {
  VisualizationType,
  expressionMatchesPalette,
  replaceColors,
} from "./visualizationTypes";
import RasterColorPalette from "./RasterColorPaletteEditor";
import { RasterCategoryEditableList } from "./RasterCategoryEditableList";

export default function RasterLayerEditor({
  updateLayerProperty,
  glLayer,
  deleteLayerProperties,
  rasterInfo,
  type,
}: {
  updateLayerProperty: LayerPropertyUpdater;
  glLayer: Layer;
  deleteLayerProperties: LayerPropertyDeleter;
  rasterInfo: RasterInfo;
  type: VisualizationType | null;
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
      {type === VisualizationType.CATEGORICAL_RASTER && (
        <>
          <RasterColorPalette
            value={
              (glLayer.metadata || {})["s:palette"] &&
              expressionMatchesPalette(
                // @ts-ignore
                glLayer.paint!["raster-color"],
                glLayer.metadata["s:palette"]
              )
                ? (glLayer.metadata || {})["s:palette"]
                : null
            }
            onChange={(palette) => {
              updateLayerProperty(
                "paint",
                "raster-color",
                replaceColors(
                  (glLayer.paint! as any)["raster-color"],
                  palette,
                  glLayer.metadata?.["s:reverse-palette"],
                  glLayer.metadata?.["s:excluded"]
                ),
                { "s:palette": palette }
              );
            }}
          />
          <RasterCategoryEditableList
            // @ts-ignore
            rasterColorExpression={glLayer.paint!["raster-color"]}
            metadata={glLayer.metadata}
            onChange={(expression, metadata) => {
              updateLayerProperty(
                "paint",
                "raster-color",
                expression,
                metadata
              );
            }}
          />
        </>
      )}
      {type === VisualizationType.RGB_RASTER && (
        <>
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
      )}
    </>
  );
}
