import { FillLayer, FillPaint, LineLayer } from "mapbox-gl";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import { isExpression } from "../../../dataLayers/legends/utils";
import * as Editor from "./Editors";
import { useContext } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { RgbaColorPicker } from "react-colorful";
import { extractFirstColorFromExpression } from "./visualizationTypes";
import { colord } from "colord";
import { isLineLayer } from "./SimplePolygonEditor";

const Popover = Editor.Popover;

export default function FillStyleEditor({
  layer,
}: {
  layer?: SeaSketchGlLayer;
}) {
  const { t, updateLayer, glLayers, addLayer } = useContext(
    Editor.GUIEditorContext
  );
  const paint = (layer?.paint || {}) as FillPaint;
  return (
    <Editor.Root>
      <Editor.Label title={t("Fill")} />
      <Editor.Control>
        <Popover.Root>
          <Popover.Trigger asChild>
            <Editor.TriggerDropdownButton>
              {isExpression(paint["fill-color"] || "#000000") ? (
                <Editor.CustomExpressionIndicator />
              ) : (
                <>
                  <span
                    className="w-18 text-right overflow-hidden"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      wordSpacing: "-3px",
                    }}
                  >
                    {layer
                      ? formatColor(paint["fill-color"] as string, "#000000")
                      : "None"}
                  </span>
                  {layer && paint["fill-color"] !== "transparent" ? (
                    <Editor.Swatch
                      color={
                        layer
                          ? (paint["fill-color"] as string) || "#000000"
                          : "transparent"
                      }
                    />
                  ) : null}
                </>
              )}
              <ChevronDownIcon />
            </Editor.TriggerDropdownButton>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="right">
              <RgbaColorPicker
                color={colord(
                  isExpression(paint["fill-color"])
                    ? extractFirstColorFromExpression(paint["fill-color"]) ||
                        "#000000"
                    : paint["fill-color"]
                ).toRgb()}
                onChange={(color) => {
                  let fillLayer = layer;
                  const c = colord(color);
                  if (layer) {
                    updateLayer(
                      glLayers.indexOf(layer),
                      "paint",
                      "fill-color",
                      c.toRgbString()
                    );
                  } else {
                    const lineLayer = glLayers.find(
                      (l) => l.type === "line"
                    ) as LineLayer;
                    fillLayer = {
                      type: "fill",
                      paint: {
                        "fill-color": c.toRgbString(),
                        "fill-opacity":
                          (lineLayer?.paint?.["line-opacity"] &&
                          !isExpression(lineLayer.paint["line-opacity"])
                            ? (lineLayer.paint["line-opacity"] as number)
                            : 1) / 2,
                      },
                      layout: {},
                    };
                    addLayer(0, fillLayer);
                  }
                  // check if there are any line layers with s:color-auto=true
                  const matchingLineLayerIndexes = glLayers
                    .filter(
                      (l) =>
                        isLineLayer(l) && l.metadata?.["s:color-auto"] === true
                    )
                    .map((l) => glLayers.indexOf(l));
                  const matchingFillLayerIndexes = glLayers
                    .filter(
                      (l) =>
                        l.type === "fill" &&
                        l.metadata?.["s:color-auto"] === true
                    )
                    .map((l) => glLayers.indexOf(l));
                  if (fillLayer) {
                    matchingLineLayerIndexes.forEach((index) => {
                      const color = autoStrokeColorForFill(
                        fillLayer as FillLayer,
                        glLayers[index]! as LineLayer
                      );
                      updateLayer(index, "paint", "line-color", color);
                    });
                    matchingFillLayerIndexes.forEach((index) => {
                      const color = autoStrokeColorForFill(
                        fillLayer as FillLayer
                      );
                      updateLayer(index, "paint", "fill-outline-color", color);
                    });
                  }
                }}
              />
              <Popover.Arrow style={{ fill: "rgba(75, 85, 99)" }} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Editor.Control>
    </Editor.Root>
  );
}

export function formatColor(color: string | undefined, defaultColor: string) {
  const c = colord(color || defaultColor);
  if (c.alpha() === 0) {
    return "None";
  } else {
    return c.toRgbString();
  }
}

export function autoStrokeColorForFill(fill?: FillLayer, line?: LineLayer) {
  let fillColor = "#000000";
  if (fill?.paint?.["fill-color"]) {
    if (isExpression(fill.paint["fill-color"])) {
      fillColor =
        extractFirstColorFromExpression(fill.paint["fill-color"]) || "#000000";
    } else {
      fillColor = fill.paint["fill-color"] as string;
    }
  }
  if (colord(fillColor).alpha() === 0) {
    return "#558";
  }
  // First, check if alpha differs substantially between fill and line
  if (
    line &&
    fill &&
    Math.abs(
      Math.abs(valueOrDefault(line.paint?.["line-opacity"], 1)) -
        Math.abs(valueOrDefault(fill.paint?.["fill-opacity"], 1))
    ) > 0.5
  ) {
    // if so, just use the fill color
    return fillColor;
  } else {
    // otherwise, determine the lightness of the fill color. If it is dark,
    // return a lighter color. If it is light, return a darker color.
    const c = colord(fillColor);
    if (c.isDark()) {
      return c.lighten(0.3).alpha(1).toRgbString();
    } else {
      return c.darken(0.15).alpha(1).toRgbString();
    }
  }
}

export function valueOrDefault(value: any, defaultValue: any) {
  if (value === undefined) {
    return defaultValue;
  } else {
    return value;
  }
}
