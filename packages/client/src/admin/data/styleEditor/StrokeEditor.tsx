import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { isFillLayer, isLineLayer } from "./SimplePolygonEditor";
import { FillLayer, FillPaint, LineLayer, LinePaint } from "mapbox-gl";
import { colord } from "colord";
import { isExpression } from "../../../dataLayers/legends/utils";
import { autoStrokeColorForFill, formatColor } from "./FillStyleEditor";
import { RgbaColorPicker } from "react-colorful";
import StrokeStyleEditor, { DASHARRAYS } from "./StrokeStyleEditor";
import Switch from "../../../components/Switch";
import { extractFirstColorFromExpression } from "./visualizationTypes";

export enum StrokeType {
  None = "None",
  Solid = "Solid",
  Dotted = "Dotted",
  Dashed = "Dashed",
  Outline = "Outline",
  CustomExpression = "Custom Expression",
}

export default function StrokeEditor({
  layer,
  fillLayer,
}: {
  layer?: Omit<LineLayer, "source" | "id">;
  fillLayer?: Omit<FillLayer, "source" | "id">;
}) {
  const {
    t,
    glLayers,
    updateLayer,
    removeLayer,
    addLayer,
    previousSettings,
    setPreviousSettings,
  } = useContext(Editor.GUIEditorContext);
  const prevStrokeColor = previousSettings?.strokeColor;
  const outline = (
    glLayers.find((l) => isFillLayer(l) && l.paint?.["fill-outline-color"])
      ?.paint as FillPaint | undefined
  )?.["fill-outline-color"];
  let color = "#000000";
  let type: StrokeType = StrokeType.None;
  let width = 1;
  // First, detect if there are any custom expressions which would break this
  // editor if unhandled
  if (
    layer &&
    isLineLayer(layer) &&
    isExpression(layer.paint?.["line-color"])
  ) {
    type = StrokeType.CustomExpression;
  } else if (!layer && outline && isExpression(outline)) {
    type = StrokeType.CustomExpression;
  } else if (
    layer &&
    isLineLayer(layer) &&
    isExpression(layer.paint?.["line-width"])
  ) {
    type = StrokeType.CustomExpression;
  } else if (layer && isLineLayer(layer) && layer.paint?.["line-dasharray"]) {
    const dasharray = layer.paint["line-dasharray"];
    for (const dash of dasharray) {
      if (Array.isArray(dash)) {
        type = StrokeType.CustomExpression;
        break;
      }
    }
  }

  if (type !== StrokeType.CustomExpression) {
    color =
      ((layer?.paint as LinePaint | undefined)?.["line-color"] as string) ||
      (outline as string);
    if (colord(color).alpha() === 0) {
      type = StrokeType.None;
    }
    if (layer && isLineLayer(layer)) {
      const dasharray = (layer.paint as LinePaint)?.["line-dasharray"];
      if (dasharray) {
        if (dasharray.join(",") === "1,2") {
          type = StrokeType.Dotted;
        } else {
          type = StrokeType.Dashed;
        }
      } else {
        type = StrokeType.Solid;
      }
    } else if (outline) {
      type = StrokeType.Outline;
    }
  }

  if (layer && isLineLayer(layer)) {
    width =
      ((layer.paint as LinePaint)?.["line-width"] as number) !== undefined
        ? ((layer.paint as LinePaint)?.["line-width"] as number)
        : 1;
  }

  if (width === 0) {
    type = StrokeType.None;
  }

  let strokeType = type.toString();
  if (
    layer &&
    isLineLayer(layer) &&
    (strokeType === "Dotted" || strokeType === "Dashed")
  ) {
    const setting = layer.paint!["line-dasharray"] as number[];
    // remember, setting will not be a complex expression since otherwise type
    // would be "Custom Expression"
    for (const dash of DASHARRAYS) {
      if (dash.mapbox.join(",") === setting.join(",")) {
        strokeType = dash.mapbox.join(",");
        break;
      }
    }
  }

  const layerIndex = layer ? glLayers.indexOf(layer) : -1;
  const Popover = Editor.Popover;

  return (
    <Editor.Root>
      <Editor.Label title={t("Stroke")} />
      <Editor.Control>
        <Popover.Root>
          <Popover.Anchor asChild>
            <div className="absolute right-12 top-9"></div>
          </Popover.Anchor>
          {type === "Custom Expression" ? (
            <Editor.CustomExpressionIndicator
              onClear={() => {
                if (layerIndex !== -1) {
                  if (
                    layer?.paint?.["line-color"] &&
                    isExpression(layer.paint["line-color"])
                  ) {
                    updateLayer(
                      layerIndex,
                      "paint",
                      "line-color",
                      extractFirstColorFromExpression(
                        layer.paint["line-color"]
                      ) || "#000000"
                    );
                  }
                  if (
                    layer?.paint?.["line-width"] &&
                    isExpression(layer.paint["line-width"])
                  ) {
                    updateLayer(layerIndex, "paint", "line-width", 1);
                  }
                  if (
                    layer?.paint?.["line-dasharray"] &&
                    isExpression(layer.paint["line-dasharray"]) &&
                    typeof layer.paint["line-dasharray"][0] === "string"
                  ) {
                    updateLayer(
                      layerIndex,
                      "paint",
                      "line-dasharray",
                      undefined
                    );
                  }
                }
              }}
            />
          ) : (
            <Popover.Trigger asChild>
              <Editor.TriggerDropdownButton>
                {type !== "Outline" && type !== "None" && (
                  <span>
                    {width}
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      "px"
                    }
                  </span>
                )}
                <span>{type}</span>
                {!isExpression(color) && type !== "None" && (
                  <Editor.Swatch
                    auto={
                      type === StrokeType.Outline
                        ? fillLayer?.metadata?.["s:color-auto"]
                        : layer?.metadata?.["s:color-auto"]
                    }
                    color={color || prevStrokeColor || "#000000"}
                  />
                )}
                <ChevronDownIcon />
              </Editor.TriggerDropdownButton>
            </Popover.Trigger>
          )}
          <Popover.Content onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="w-80 px-2">
              <StrokeEditorForm
                auto={
                  type === StrokeType.Outline
                    ? fillLayer?.metadata?.["s:color-auto"] === true
                    : layer?.metadata?.["s:color-auto"] === true
                }
                previousColor={prevStrokeColor}
                hasFillLayer={Boolean(fillLayer)}
                width={width}
                color={color}
                type={type}
                i18n={t}
                onChange={(newType, newWidth, color, dasharray, autoColor) => {
                  if (newType !== StrokeType.None && type === StrokeType.None) {
                    autoColor = previousSettings.autoStrokeColor || false;
                  }
                  const metadata = {
                    "s:color-auto": autoColor,
                  };
                  setPreviousSettings((prev) => ({
                    ...prev,
                    autoStrokeColor: autoColor,
                  }));

                  if (layerIndex !== -1) {
                    updateLayer(
                      layerIndex,
                      undefined,
                      undefined,
                      undefined,
                      metadata
                    );
                  }
                  if (autoColor) {
                    const fillLayer = glLayers.find((l) => isFillLayer(l));
                    color = autoStrokeColorForFill(
                      fillLayer as FillLayer,
                      layer as LineLayer
                    );
                  }
                  const oldType = type;
                  if (newType !== oldType && newWidth === 0) {
                    newWidth = 1;
                  }
                  const oldWidth = width;
                  setPreviousSettings((prev) => ({
                    ...prev,
                    strokeColor: color,
                    strokeWidth: newWidth,
                    dasharray,
                  }));

                  if (newType === StrokeType.None && newWidth === oldWidth) {
                    // remove fill-outline-color if exists
                    const outlineLayer = glLayers.findIndex(
                      (l) => isFillLayer(l) && l.paint?.["fill-outline-color"]
                    );
                    if (outlineLayer !== -1) {
                      updateLayer(
                        outlineLayer,
                        "paint",
                        "fill-outline-color",
                        undefined,
                        metadata
                      );
                    }
                    // remove stroke layer if exists
                    if (layer) {
                      removeLayer(layerIndex);
                    }
                  } else if (newType === StrokeType.Outline) {
                    if (!fillLayer) {
                      throw new Error("No fill layer found");
                    }
                    updateLayer(
                      glLayers.indexOf(fillLayer),
                      "paint",
                      "fill-outline-color",
                      color || prevStrokeColor || "#000000",
                      metadata
                    );
                    // remove stroke layer if exists
                    if (layer) {
                      removeLayer(layerIndex);
                    }
                  } else {
                    // clear all outlines
                    const outlineLayers = glLayers
                      .filter(
                        (l) => isFillLayer(l) && l.paint?.["fill-outline-color"]
                      )
                      .map((l) => glLayers.indexOf(l));
                    for (const outlineLayer of outlineLayers) {
                      updateLayer(
                        outlineLayer,
                        "paint",
                        "fill-outline-color",
                        undefined,
                        metadata
                      );
                    }
                    if (layer) {
                      // update the layer
                      // update color
                      if (layer.paint?.["line-color"] !== color) {
                        updateLayer(
                          layerIndex,
                          "paint",
                          "line-color",
                          color,
                          metadata
                        );
                      }
                      // update width
                      if (layer.paint?.["line-width"] !== newWidth) {
                        updateLayer(
                          layerIndex,
                          "paint",
                          "line-width",
                          newWidth
                        );
                      }
                      if (
                        newType === StrokeType.None &&
                        oldWidth !== newWidth &&
                        previousSettings.dasharray
                      ) {
                        dasharray = previousSettings.dasharray;
                      }
                      if (dasharray) {
                        updateLayer(
                          layerIndex,
                          "paint",
                          "line-dasharray",
                          dasharray.split(",").map((s) => parseInt(s))
                        );
                      } else {
                        if (layer.paint?.["line-dasharray"]) {
                          updateLayer(
                            layerIndex,
                            "paint",
                            "line-dasharray",
                            undefined,
                            metadata
                          );
                        }
                      }

                      // update dasharray
                    } else {
                      // create the layer
                      let dasharraySetting = {};
                      if (dasharray) {
                        dasharraySetting = {
                          "line-dasharray": dasharray
                            .split(",")
                            .map((s) => parseInt(s)),
                        };
                      }
                      // Find the index of the last fill layer in glLayers
                      let fillLayerIndex = 0;
                      for (let i = 0; i < glLayers.length; i++) {
                        if (isFillLayer(glLayers[i])) {
                          fillLayerIndex = i;
                        }
                      }
                      addLayer(fillLayerIndex + 1, {
                        type: "line",
                        paint: {
                          "line-color":
                            color || previousSettings.strokeColor || "#000000",
                          "line-width":
                            newWidth || previousSettings?.strokeWidth || 1,
                          ...dasharraySetting,
                        },
                        layout: {},
                        metadata,
                      });
                    }
                  }
                }}
              />
            </div>
            <Popover.Arrow style={{ fill: "rgba(75, 85, 99)" }} />
          </Popover.Content>
        </Popover.Root>
      </Editor.Control>
    </Editor.Root>
  );
}

export function StrokeEditorForm({
  width,
  color,
  type,
  i18n: t,
  onChange,
  hasFillLayer,
  previousColor,
  auto,
}: {
  width: number;
  color?: string;
  type: StrokeType;
  i18n: (key: string) => string;
  onChange: (
    type: StrokeType,
    width: number,
    color?: string,
    dasharray?: string,
    autoColor?: boolean
  ) => void;
  hasFillLayer: boolean;
  previousColor?: string;
  auto: boolean;
}) {
  const Popover = Editor.Popover;

  const { glLayers } = useContext(Editor.GUIEditorContext);

  const dasharray = useMemo(() => {
    if (type === "Dotted" || type === "Dashed") {
      const lineLayer = glLayers.find(
        (l) => isLineLayer(l) && l.paint?.["line-dasharray"]
      );
      if (lineLayer) {
        return (lineLayer.paint as LinePaint)?.["line-dasharray"];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }, [glLayers, type]);

  return (
    <>
      <StrokeStyleEditor
        value={type}
        onChange={(value, dasharray) =>
          onChange(value, width, color, dasharray, auto)
        }
        dasharray={dasharray ? dasharray.join(",") : undefined}
        hasFillLayer={hasFillLayer}
      />
      <Editor.Root disabled={type === StrokeType.Outline}>
        <Editor.Label title={t("Stroke Width")} />
        <Editor.Control>
          <Editor.NumberSliderAndInput
            value={
              type === StrokeType.None
                ? 0
                : type === StrokeType.Outline
                ? 0.25
                : width
            }
            min={0}
            max={10}
            step={0.5}
            onChange={(value) => {
              onChange(
                type,
                value,
                color,
                dasharray ? dasharray.join(",") : undefined,
                auto
              );
            }}
          />
        </Editor.Control>
      </Editor.Root>
      <Editor.Root disabled={type === "None"}>
        <Editor.Label title={t("Stroke Color")} />
        <Editor.Control>
          <Popover.Root>
            <Popover.Trigger asChild>
              <Editor.TriggerDropdownButton>
                <span>
                  {auto
                    ? "Auto"
                    : formatColor(color, previousColor || "#000000")}
                </span>
                <Editor.Swatch color={color || previousColor || "#000000"} />
              </Editor.TriggerDropdownButton>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content side="right" sideOffset={12}>
                <RgbaColorPicker
                  color={colord(color || "#000000").toRgb()}
                  onChange={(color) => {
                    onChange(
                      type,
                      width,
                      colord(color).toRgbString(),
                      dasharray ? dasharray.join(",") : undefined,
                      false
                    );
                  }}
                />
                <div className="p-2 text-xs flex items-center text-white">
                  <Switch
                    onClick={(val) => {
                      onChange(
                        type,
                        width,
                        color,
                        dasharray ? dasharray.join(",") : undefined,
                        val
                      );
                    }}
                    isToggled={auto}
                    className="transform scale-75"
                  />
                  <p>{t("Auto color based on fill")}</p>
                </div>
                <Popover.Arrow style={{ fill: "rgba(75, 85, 99)" }} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </Editor.Control>
      </Editor.Root>
    </>
  );
}
