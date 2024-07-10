import { Expression, RasterLayer, RasterPaint } from "mapbox-gl";
import { LayerPropertyDeleter, LayerPropertyUpdater } from "./GUIStyleEditor";
import RasterFadDurationEditor from "./RasterFadeDurationEditor";
import RasterResamplingEditor from "./RasterResamplingEditor";
import * as Editor from "./Editors";
import { useTranslation } from "react-i18next";
import { RasterContrastEditor } from "./RasterContrastEditor";
import { RasterSaturationEditor } from "./RasterSaturationEditor";
import { RasterBrightnessEditor } from "./RasterBrightnessEditor";
import { RasterHueRotateEditor } from "./RasterHueRotateEditor";
import { useCallback, useEffect, useMemo } from "react";
import { RasterInfo } from "@seasketch/geostats-types";
import {
  VisualizationType,
  buildContinuousRasterColorExpression,
  expressionMatchesPalette,
  extractColorsFromExpression,
  extractValueRange,
  replaceColors,
} from "./visualizationTypes";
import PaletteSelect from "./PaletteSelect";
import { CategoryEditableList } from "./CategoryEditableList";
import HistogramControl from "./HistogramControl";
import Switch from "../../../components/Switch";
import ContinuousStepsEditor, { determineSteps } from "./ContinuousStepsEditor";
import { OpacityEditor } from "./OpacityEditor";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import VisualizationTypeControl from "./VisualizationTypeControl";

function RasterLayerEditor({
  updateLayerProperty,
  glLayer,
  deleteLayerProperties,
  rasterInfo,
  type,
}: {
  updateLayerProperty: LayerPropertyUpdater;
  glLayer: SeaSketchGlLayer;
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

  const onCategoriesChange = useCallback(
    (expression: Expression, metadata: Editor.SeaSketchLayerMetadata) => {
      updateLayerProperty("paint", "raster-color", expression, metadata);
    },
    [updateLayerProperty]
  );

  const paint = glLayer.paint as RasterPaint;

  const steps = (paint || {})["raster-color"]
    ? determineSteps(
        paint["raster-color"]! as Expression,
        rasterInfo.bands[0].stats,
        glLayer.metadata
      )
    : undefined;

  return (
    <Editor.Card>
      <VisualizationTypeControl
        buttons={
          <LimitZoomTrigger
            minzoom={glLayer.minzoom}
            maxzoom={glLayer.maxzoom}
            updateLayerProperty={updateLayerProperty}
          />
        }
      />

      <ZoomRangeEditor
        maxzoom={glLayer.maxzoom}
        minzoom={glLayer.minzoom}
        onChange={(min, max) => {
          updateLayerProperty(undefined, "minzoom", min);
          updateLayerProperty(undefined, "maxzoom", max);
        }}
      />

      <OpacityEditor
        value={
          // @ts-ignore
          glLayer.paint?.[`${glLayer.type}-opacity`] as number | undefined
        }
        onChange={(value: number) =>
          updateLayerProperty("paint", `${glLayer.type}-opacity`, value)
        }
      />

      <RasterResamplingEditor
        onChange={(value) => {
          updateLayerProperty("paint", "raster-resampling", value);
        }}
        value={paint["raster-resampling"]}
      />
      <RasterFadDurationEditor
        onChange={(value) => {
          updateLayerProperty("paint", "raster-fade-duration", value);
        }}
        // @ts-ignore
        value={glLayer.paint?.["raster-fade-duration"]}
      />
      {(type === VisualizationType.CATEGORICAL_RASTER ||
        type === VisualizationType.CONTINUOUS_RASTER) && (
        <>
          <PaletteSelect
            steps={steps}
            type={
              type === VisualizationType.CATEGORICAL_RASTER
                ? "categorical"
                : "continuous"
            }
            reversed={glLayer.metadata?.["s:reverse-palette"] || false}
            value={
              (glLayer.metadata || {})["s:palette"] &&
              expressionMatchesPalette(
                paint["raster-color"]! as Expression,
                glLayer.metadata["s:palette"],
                Boolean(glLayer.metadata["s:reverse-palette"]),
                steps!
              )
                ? (glLayer.metadata || {})["s:palette"]
                : null
            }
            onChange={(palette, reverse) => {
              updateLayerProperty(
                "paint",
                "raster-color",
                replaceColors(
                  (glLayer.paint! as any)["raster-color"],
                  palette,
                  Boolean(reverse),
                  glLayer.metadata?.["s:excluded"] || [],
                  steps
                ),
                { "s:palette": palette, "s:reverse-palette": reverse }
              );
            }}
          />
        </>
      )}

      {type === VisualizationType.CATEGORICAL_RASTER && (
        <CategoryEditableList
          expression={paint["raster-color"] as Expression}
          metadata={glLayer.metadata}
          onChange={onCategoriesChange}
        />
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
      {isRasterLayer(glLayer) &&
        glLayer.paint?.["raster-color"] &&
        type === VisualizationType.CONTINUOUS_RASTER && (
          <>
            <ContinuousStepsEditor
              stats={rasterInfo.bands[0].stats}
              minimum={rasterInfo.bands[0].minimum}
              maximum={rasterInfo.bands[0].maximum}
              expression={(glLayer.paint as any)["raster-color"]}
              metadata={glLayer.metadata}
              updateLayerProperty={updateLayerProperty}
              valueExpression={["raster-value"]}
            />
            <HistogramControl
              expression={paint["raster-color"]! as Expression}
              histogram={rasterInfo.bands[0].stats.histogram}
              range={extractValueRange(
                (glLayer!.paint! as RasterPaint)["raster-color"] as Expression
              )}
              onRangeChange={(range) => {
                let palette = glLayer.metadata?.["s:palette"] as any;
                if (
                  !expressionMatchesPalette(
                    // @ts-ignore
                    glLayer.paint!["raster-color"],
                    palette,
                    glLayer.metadata?.["s:reverse-palette"],
                    steps!
                  )
                ) {
                  palette = extractColorsFromExpression(
                    // @ts-ignore
                    glLayer.paint["raster-color"]!
                  );
                }
                const expr = buildContinuousRasterColorExpression(
                  // @ts-ignore
                  glLayer.paint["raster-color"],
                  palette,
                  glLayer.metadata?.["s:reverse-palette"],
                  range
                );
                updateLayerProperty("paint", "raster-color", expr);
              }}
            />
          </>
        )}
      {type === VisualizationType.CONTINUOUS_RASTER && (
        <>
          <Editor.Header title={t("Legend")} className="pt-6" />
          {(rasterInfo.bands[0].offset || rasterInfo.bands[0].scale) && (
            <div className="space-y-2">
              <Editor.Control>
                <Editor.Label
                  title={t("Respect Scale and Offset")}
                  tooltip={t(
                    "When rasters provide offset and/or scale metadata, this info can be used to adjust values in the legend."
                  )}
                />
                <Switch
                  isToggled={
                    glLayer.metadata?.["s:respect-scale-and-offset"] || false
                  }
                  onClick={(value) => {
                    updateLayerProperty(undefined, undefined, undefined, {
                      "s:respect-scale-and-offset": value,
                    });
                  }}
                />
              </Editor.Control>
              <Editor.Control>
                <Editor.Label title={t("Display rounded numbers")} />
                <Switch
                  isToggled={glLayer.metadata?.["s:round-numbers"] || false}
                  onClick={(value) => {
                    updateLayerProperty(undefined, undefined, undefined, {
                      "s:round-numbers": value,
                    });
                  }}
                />
              </Editor.Control>
              <Editor.Control>
                <Editor.Label
                  title={t("Value suffix")}
                  tooltip={t("Used to append text to values in the legend.")}
                />
                <input
                  type="text"
                  className="bg-gray-700 rounded py-0.5 pr-0.5 w-24 text-center"
                  value={glLayer.metadata?.["s:value-suffix"] || ""}
                  onChange={(e) => {
                    updateLayerProperty(undefined, undefined, undefined, {
                      "s:value-suffix": e.target.value,
                    });
                  }}
                />
              </Editor.Control>
            </div>
          )}
        </>
      )}
    </Editor.Card>
  );
}

RasterLayerEditor.hasUnrelatedLayers = (layers: SeaSketchGlLayer[]) => {
  return layers.length > 1;
};

export function isRasterLayer(layer: SeaSketchGlLayer): layer is RasterLayer {
  return layer.type === "raster";
}

export default RasterLayerEditor;
