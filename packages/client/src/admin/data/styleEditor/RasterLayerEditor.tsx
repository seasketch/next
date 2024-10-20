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
import { useCallback, useContext, useEffect, useMemo } from "react";
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
  deleteLayerProperties,
  rasterInfo,
  type,
}: {
  updateLayerProperty: LayerPropertyUpdater;
  deleteLayerProperties: LayerPropertyDeleter;
  rasterInfo: RasterInfo;
  type: VisualizationType | null;
}) {
  const { t } = useTranslation("admin:data");
  const context = useContext(Editor.GUIEditorContext);
  const glLayer = context.glLayers.find((l) =>
    isRasterLayer(l)
  ) as SeaSketchGlLayer<RasterLayer>;

  const p = glLayer.paint || {};
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    p["raster-contrast"],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    p["raster-saturation"],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    p["raster-hue-rotate"],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    p["raster-brightness-min"],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    p["raster-brightness-max"],
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
    <>
      <Editor.CardButtons>
        <LimitZoomTrigger
          minzoom={glLayer.minzoom}
          maxzoom={glLayer.maxzoom}
          updateLayerProperty={updateLayerProperty}
        />
      </Editor.CardButtons>

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
                steps!,
                true
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
                  steps,
                  Boolean(glLayer.metadata?.["s:exclude-outside-range"])
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
              updateLayerProperty={(type, property, value, metadata) => {
                // clear filters and s:exclude-outside-range
                context.updateLayer(0, undefined, undefined, undefined, {
                  "s:exclude-outside-range": false,
                });
                updateLayerProperty(type, property, value, metadata);
              }}
              valueExpression={["raster-value"]}
            />
            <HistogramControl
              expression={paint["raster-color"]! as Expression}
              histogram={rasterInfo.bands[0].stats.histogram}
              range={extractValueRange(
                (glLayer!.paint! as RasterPaint)["raster-color"] as Expression,
                Boolean(glLayer?.metadata?.["s:exclude-outside-range"])
              )}
              onRangeChange={(range, excludeOutsideRange) => {
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
                let expr = buildContinuousRasterColorExpression(
                  // @ts-ignore
                  glLayer.paint["raster-color"],
                  palette,
                  glLayer.metadata?.["s:reverse-palette"],
                  range
                );
                const applyFilter =
                  excludeOutsideRange &&
                  (range[0] > rasterInfo.bands[0].minimum ||
                    range[1] < rasterInfo.bands[0].maximum);
                if (applyFilter) {
                  // Modify the expression to exclude values outside the range
                  const head = expr.slice(0, 3);
                  const values = expr.slice(3);
                  const interval = (values[2] - values[0]) / 1000;
                  const newValues = [
                    values[0] - interval,
                    "transparent",
                    ...values,
                    values[values.length - 2] + interval,
                    "transparent",
                  ];
                  expr = [...head, ...newValues];
                }
                context.updateLayer(0, "paint", "raster-color", expr, {
                  "s:exclude-outside-range": excludeOutsideRange,
                });
                // updateLayerProperty("paint", "raster-color", expr);
              }}
              excludeOutsideRange={
                glLayer.metadata?.["s:exclude-outside-range"]
              }
            />
          </>
        )}
      {type === VisualizationType.CONTINUOUS_RASTER && (
        <>
          <Editor.Header title={t("Legend")} className="pt-6" />
          {(rasterInfo.bands[0].offset || rasterInfo.bands[0].scale) && (
            <>
              <Editor.Root>
                <Editor.Label
                  title={t("Respect Scale and Offset")}
                  tooltip={t(
                    "When rasters provide offset and/or scale metadata, this info can be used to adjust values in the legend."
                  )}
                />
                <Editor.Control>
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
              </Editor.Root>
            </>
          )}
          <Editor.Root>
            <Editor.Label title={t("Display rounded numbers")} />
            <Editor.Control>
              <Switch
                isToggled={glLayer.metadata?.["s:round-numbers"] || false}
                onClick={(value) => {
                  updateLayerProperty(undefined, undefined, undefined, {
                    "s:round-numbers": value,
                  });
                }}
              />
            </Editor.Control>
          </Editor.Root>
          <Editor.Root>
            <Editor.Label
              title={t("Value suffix")}
              tooltip={t("Used to append text to values in the legend.")}
            />
            <Editor.Control>
              <Editor.TextInput
                className="w-24 text-center"
                value={glLayer.metadata?.["s:value-suffix"] || ""}
                onValueChange={(v) => {
                  updateLayerProperty(undefined, undefined, undefined, {
                    "s:value-suffix": v,
                  });
                }}
              />
            </Editor.Control>
          </Editor.Root>
        </>
      )}
    </>
  );
}

RasterLayerEditor.hasUnrelatedLayers = (layers: SeaSketchGlLayer[]) => {
  return layers.length > 1;
};

export function isRasterLayer(layer: SeaSketchGlLayer): layer is RasterLayer {
  return layer.type === "raster";
}

export default RasterLayerEditor;
