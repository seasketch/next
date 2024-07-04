import { useContext } from "react";
import * as Editor from "./Editors";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { isFillLayer, isLineLayer } from "./SimplePolygonEditor";
import { FillPaint, LinePaint } from "mapbox-gl";
import { colord } from "colord";
import { isExpression } from "../../../dataLayers/legends/utils";
import { formatColor } from "./FillStyleEditor";
import { RgbaColorPicker } from "react-colorful";
import { svg } from "d3";
const Popover = Editor.Popover;

enum StrokeType {
  None = "None",
  Solid = "Solid",
  Dotted = "Dotted",
  Dashed = "Dashed",
  Outline = "Outline",
  CustomExpression = "Custom Expression",
}

export default function StrokeEditor({ layer }: { layer?: SeaSketchGlLayer }) {
  const { t, glLayers, updateLayer } = useContext(Editor.GUIEditorContext);
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
      (outline as string) ||
      "#000000";
    if (colord(color).alpha() === 0) {
      type = StrokeType.None;
    }
    if (layer && isLineLayer(layer)) {
      const dasharray = (layer.paint as LinePaint)?.["line-dasharray"];
      if (dasharray) {
        if (dasharray.join(",") === "0,2") {
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

  return (
    <Editor.Root>
      <Editor.Label title={t("Stroke")} />
      <Editor.Control>
        <Popover.Root>
          <Popover.Anchor asChild>
            <div className="absolute right-12 top-9"></div>
          </Popover.Anchor>
          <Popover.Trigger asChild>
            <Editor.TriggerDropdownButton>
              {type === "Custom Expression" ? (
                <Editor.CustomExpressionIndicator />
              ) : (
                <>
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
                  {/* {!isExpression(color) && (
                    <span>{formatColor(color, "#000000")}</span>
                  )} */}
                  {!isExpression(color) && type !== "None" && (
                    <Editor.Swatch color={color as string} />
                  )}
                </>
              )}
              <ChevronDownIcon />
            </Editor.TriggerDropdownButton>
          </Popover.Trigger>
          <Popover.Content>
            <div className="w-80 px-2">
              <StrokeEditorForm
                width={width}
                color={color}
                type={type}
                i18n={t}
                onChange={(type, width, color) => {
                  // console.log(type, width, color);
                  if (type === "Outline") {
                    const outlineLayer = glLayers.find(
                      (l) => isFillLayer(l) && l.paint?.["fill-outline-color"]
                    );
                    if (!outlineLayer) {
                      throw new Error("No outline layer found");
                    }
                    updateLayer(
                      glLayers.indexOf(outlineLayer),
                      "paint",
                      "fill-outline-color",
                      color
                    );
                  } else if (layer) {
                    // TODO: updating the layer twice rapidly causes an
                    // exception. The updateLayer function really ought to
                    // change in order to batch updates and avoid this, but also
                    // the API should change to accept multiple properties to
                    // update. If that was in place, these guards would not be
                    // necessary (or could be implemented as an optimization in
                    // updateLayer).
                    if ((layer.paint as LinePaint)?.["line-color"] !== color) {
                      updateLayer(
                        glLayers.indexOf(layer),
                        "paint",
                        "line-color",
                        color
                      );
                    }
                    if ((layer.paint as LinePaint)?.["line-width"] !== width) {
                      updateLayer(
                        glLayers.indexOf(layer),
                        "paint",
                        "line-width",
                        width
                      );
                    }
                  }
                }}
              />
              {/* <Editor.Root>
                <Editor.Label title={t("Stroke Type")} />
                <Editor.Control></Editor.Control>
              </Editor.Root>
              <Editor.Root>
                <Editor.Label title={t("Stroke Width")} />
                <Editor.Control>
                  <Editor.NumberSliderAndInput
                    value={width}
                    min={0}
                    max={10}
                    step={1}
                    onChange={(value) => {
                      if (type !== "Outline" && layer) {
                        updateLayer(
                          glLayers.indexOf(layer),
                          "paint",
                          "line-width",
                          value
                        );
                      }
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
                        <span>{formatColor(color, "#000000")}</span>
                        <Editor.Swatch color={color} />
                      </Editor.TriggerDropdownButton>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content side="right" sideOffset={12}>
                        <RgbaColorPicker
                          color={colord(color).toRgb()}
                          onChange={(color) => {
                            const c = colord(color);
                            if (type === "Outline") {
                              const outlineLayer = glLayers.find(
                                (l) =>
                                  isFillLayer(l) &&
                                  l.paint?.["fill-outline-color"]
                              );
                              if (!outlineLayer) {
                                throw new Error("No outline layer found");
                              }
                              updateLayer(
                                glLayers.indexOf(outlineLayer),
                                "paint",
                                "fill-outline-color",
                                c.toRgbString()
                              );
                            } else if (layer) {
                              updateLayer(
                                glLayers.indexOf(layer),
                                "paint",
                                "line-color",
                                c.toRgbString()
                              );
                            }
                          }}
                        />
                        <Popover.Arrow style={{ fill: "rgba(75, 85, 99)" }} />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </Editor.Control>
              </Editor.Root> */}
            </div>
            <Popover.Arrow style={{ fill: "rgba(75, 85, 99)" }} />
          </Popover.Content>
        </Popover.Root>
      </Editor.Control>
    </Editor.Root>
  );
}

const DASHARRAYS = [
  {
    mapbox: [4, 4],
    svg: "6,6",
  },
  {
    mapbox: [4, 2],
    svg: "6,2",
  },
  {
    mapbox: [2, 2],
    svg: "0,2",
  },
];

export function StrokeEditorForm({
  width,
  color,
  type,
  i18n: t,
  onChange,
}: {
  width: number;
  color?: string;
  type: StrokeType;
  i18n: (key: string) => string;
  onChange: (type: StrokeType, width: number, color?: string) => void;
}) {
  return (
    <>
      <Editor.Root>
        <Editor.Label title={t("Stroke Type")} />
        <Editor.Control></Editor.Control>
      </Editor.Root>
      <Editor.Root>
        <Editor.Label title={t("Stroke Width")} />
        <Editor.Control>
          <Editor.NumberSliderAndInput
            value={width}
            min={0}
            max={10}
            step={1}
            onChange={(value) => {
              onChange(type, value, color);
              // if (type !== "Outline" && layer) {
              //   updateLayer(
              //     glLayers.indexOf(layer),
              //     "paint",
              //     "line-width",
              //     value
              //   );
              // }
            }}
          />
        </Editor.Control>
      </Editor.Root>
      <Editor.Root disabled={type === "None"}>
        <Editor.Label title={t("Stroke Color")} />
        <Editor.Control>
          {color && (
            <Popover.Root>
              <Popover.Trigger asChild>
                <Editor.TriggerDropdownButton>
                  <span>{formatColor(color, "#000000")}</span>
                  <Editor.Swatch color={color} />
                </Editor.TriggerDropdownButton>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content side="right" sideOffset={12}>
                  <RgbaColorPicker
                    color={colord(color).toRgb()}
                    onChange={(color) => {
                      onChange(type, width, colord(color).toRgbString());
                      // const c = colord(color);
                      // if (type === "Outline") {
                      //   const outlineLayer = glLayers.find(
                      //     (l) => isFillLayer(l) && l.paint?.["fill-outline-color"]
                      //   );
                      //   if (!outlineLayer) {
                      //     throw new Error("No outline layer found");
                      //   }
                      //   updateLayer(
                      //     glLayers.indexOf(outlineLayer),
                      //     "paint",
                      //     "fill-outline-color",
                      //     c.toRgbString()
                      //   );
                      // } else if (layer) {
                      //   updateLayer(
                      //     glLayers.indexOf(layer),
                      //     "paint",
                      //     "line-color",
                      //     c.toRgbString()
                      //   );
                      // }
                    }}
                  />
                  <Popover.Arrow style={{ fill: "rgba(75, 85, 99)" }} />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
        </Editor.Control>
      </Editor.Root>
    </>
  );
}
