import { useContext } from "react";
import * as Editor from "./Editors";
import { Expression, HeatmapLayer, HeatmapPaint } from "mapbox-gl";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { OpacityEditor } from "./OpacityEditor";
import { isExpression } from "../../../dataLayers/legends/utils";
import PaletteSelect from "./PaletteSelect";
import { expressionMatchesPalette, replaceColors } from "./visualizationTypes";
import { StepsSetting } from "./ContinuousStepsEditor";
import { colord } from "colord";

export default function HeatmapEditor() {
  const context = useContext(Editor.GUIEditorContext);
  const t = context.t;

  const index = context.glLayers.findIndex((l) => l.type === "heatmap");
  const layer = context.glLayers[index] as undefined | HeatmapLayer;

  if (!layer) {
    return null;
  }

  const steps = {
    steps: "continuous",
    n: 6,
  } as StepsSetting;

  return (
    <>
      <Editor.CardButtons>
        <LimitZoomTrigger
          minzoom={layer.minzoom}
          maxzoom={layer.maxzoom}
          updateLayerProperty={(...args) => {
            context.updateLayer(index, ...args);
          }}
        />
      </Editor.CardButtons>
      <ZoomRangeEditor
        minzoom={layer.minzoom}
        maxzoom={layer.maxzoom}
        onChange={(min, max) => {
          if (index !== -1) {
            context.updateLayer(index, undefined, "minzoom", min);
            context.updateLayer(index, undefined, "maxzoom", max);
          }
        }}
      />
      <OpacityEditor
        value={
          layer.paint?.["heatmap-opacity"] as number | Expression | undefined
        }
        fillColor={
          layer.paint?.["heatmap-color"] &&
          !isExpression(layer.paint["heatmap-color"])
            ? (layer.paint?.["heatmap-color"] as string)
            : undefined
        }
        onChange={(value) => {
          if (index !== -1) {
            context.updateLayer(index, "paint", "heatmap-opacity", value);
          }
        }}
      />
      <PaletteSelect
        steps={undefined}
        type={"continuous"}
        reversed={layer?.metadata?.["s:reverse-palette"] || false}
        value={
          (layer?.metadata || {})["s:palette"] &&
          expressionMatchesPalette(
            layer?.paint?.["heatmap-color"]! as Expression,
            layer?.metadata["s:palette"],
            Boolean(layer?.metadata["s:reverse-palette"]),
            steps,
            true
          )
            ? (layer?.metadata || {})["s:palette"]
            : null
        }
        onChange={(palette, reverse) => {
          const heatmapColorExpr = replaceColors(
            (layer.paint! as HeatmapPaint)["heatmap-color"] as Expression,
            palette,
            Boolean(reverse),
            layer?.metadata?.["s:excluded"] || [],
            steps
          );
          heatmapColorExpr[4] = colord(heatmapColorExpr[4])
            .alpha(0)
            .toRgbString();
          context.updateLayer(
            index,
            "paint",
            "heatmap-color",
            heatmapColorExpr,
            {
              "s:palette": palette,
              "s:reverse-palette": Boolean(reverse),
            }
          );
        }}
      />
      <Editor.Root>
        <Editor.Label title={t("Radius")} />
        <Editor.Control>
          {isExpression(layer.paint?.["heatmap-radius"]) ? (
            <Editor.CustomExpressionIndicator
              onClear={() => {
                context.updateLayer(
                  index,
                  "paint",
                  "heatmap-radius",
                  undefined
                );
              }}
            />
          ) : (
            <Editor.NumberSliderAndInput
              max={30}
              min={1}
              step={1}
              value={(layer.paint?.["heatmap-radius"] as number) || 1}
              onChange={(number) => {
                context.updateLayer(index, "paint", "heatmap-radius", number);
              }}
            />
          )}
        </Editor.Control>
      </Editor.Root>
      {/* TODO: add support for zoom-dependent expressions for all these */}
      {/* TODO: add support for data-dependent expressions for all these */}
      <Editor.Root>
        <Editor.Label title={t("Intensity")} />
        <Editor.Control>
          {isExpression(layer.paint?.["heatmap-intensity"]) ? (
            <Editor.CustomExpressionIndicator
              onClear={() => {
                context.updateLayer(
                  index,
                  "paint",
                  "heatmap-intensity",
                  undefined
                );
              }}
            />
          ) : (
            <Editor.NumberSliderAndInput
              max={1}
              min={0}
              step={0.1}
              value={(layer.paint?.["heatmap-intensity"] as number) || 1}
              onChange={(number) => {
                context.updateLayer(
                  index,
                  "paint",
                  "heatmap-intensity",
                  number
                );
              }}
            />
          )}
        </Editor.Control>
      </Editor.Root>
    </>
  );
}

HeatmapEditor.hasUnrelatedLayers = (glLayers: any[]) => {
  return glLayers.length > 1;
};
