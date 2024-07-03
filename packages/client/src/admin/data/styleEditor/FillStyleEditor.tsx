import { FillPaint, LineLayer, LinePaint } from "mapbox-gl";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import { isExpression } from "../../../dataLayers/legends/utils";
import * as Editor from "./Editors";
import { useContext } from "react";
import { ChevronDownIcon, FontFamilyIcon } from "@radix-ui/react-icons";
import { CalculatorIcon } from "@heroicons/react/outline";
import { RgbaColorPicker } from "react-colorful";
import {
  extractColorsFromExpression,
  extractFirstColorFromExpression,
} from "./visualizationTypes";
import { colord } from "colord";

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
                    className="w-18 text-right overflow-hidden font-mono"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      wordSpacing: "-6px",
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
                    const fillLayer = {
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
    return c.toRgbString().toUpperCase();
  }
}
