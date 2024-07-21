import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { CircleLayer } from "mapbox-gl";
import { isExpression } from "../../../dataLayers/legends/utils";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { autoStrokeForFillColor, formatColor } from "./FillStyleEditor";
import { RgbaColorPicker } from "react-colorful";
import { colord } from "colord";
import Switch from "../../../components/Switch";

export default function CircleStrokeEditor() {
  const context = useContext(Editor.GUIEditorContext);
  const circleLayerIndex = useMemo(
    () => context.glLayers.findIndex((l) => l.type === "circle"),
    [context.glLayers]
  );
  const circleLayer = context.glLayers[circleLayerIndex] as CircleLayer;
  const { t } = context;
  if (circleLayerIndex === -1) {
    return null;
  }
  const Popover = Editor.Popover;
  const auto = (circleLayer.metadata as Editor.SeaSketchLayerMetadata)?.[
    "s:color-auto"
  ];
  const color = circleLayer.paint?.["circle-stroke-color"] as
    | string
    | undefined;

  return (
    <Editor.Root>
      <Editor.Label title={t("Stroke")} />
      <Editor.Control>
        {(circleLayer.paint?.["circle-stroke-color"] &&
          isExpression(circleLayer.paint?.["circle-stroke-color"])) ||
        (circleLayer.paint?.["circle-stroke-width"] &&
          isExpression(circleLayer.paint?.["circle-stroke-width"])) ? (
          <Editor.CustomExpressionIndicator
            onClear={() => {
              context.updateLayer(
                circleLayerIndex,
                "paint",
                "circle-stroke-color",
                undefined
              );
              context.updateLayer(
                circleLayerIndex,
                "paint",
                "circle-stroke-width",
                undefined
              );
            }}
          />
        ) : (
          <Popover.Root>
            <Popover.Anchor asChild>
              <div className="absolute right-12 top-9"></div>
            </Popover.Anchor>
            <Popover.Trigger asChild>
              <Editor.TriggerDropdownButton>
                <span>
                  {circleLayer.paint?.["circle-stroke-width"] || 0}
                  {
                    // eslint-disable-next-line i18next/no-literal-string
                    "px Solid"
                  }
                </span>
                <Editor.Swatch
                  auto={circleLayer?.metadata?.["s:color-auto"]}
                  color={
                    (circleLayer.paint?.["circle-stroke-color"] as string) ||
                    "#000000"
                  }
                />
                <ChevronDownIcon />
              </Editor.TriggerDropdownButton>
            </Popover.Trigger>
            <Popover.Content onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="w-80 px-2">
                <Editor.Root>
                  <Editor.Label title={t("Stroke Width")} />
                  <Editor.Control>
                    <Editor.NumberSliderAndInput
                      value={
                        (circleLayer.paint?.[
                          "circle-stroke-width"
                        ] as number) || 0
                      }
                      min={0}
                      max={10}
                      step={1}
                      onChange={(value) => {
                        context.updateLayer(
                          circleLayerIndex,
                          "paint",
                          "circle-stroke-width",
                          value
                        );
                      }}
                    />
                  </Editor.Control>
                </Editor.Root>
                <Editor.Root
                  disabled={
                    ((circleLayer.paint?.["circle-stroke-width"] as number) ||
                      0) === 0
                  }
                >
                  <Editor.Label title={t("Stroke Color")} />
                  <Editor.Control>
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <Editor.TriggerDropdownButton>
                          <span>
                            {auto ? "Auto" : formatColor(color, "#000000")}
                          </span>
                          <Editor.Swatch color={color || "#000000"} />
                        </Editor.TriggerDropdownButton>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content side="right" sideOffset={12}>
                          <RgbaColorPicker
                            color={colord(color || "#000000").toRgb()}
                            onChange={(color) => {
                              context.updateLayer(
                                circleLayerIndex,
                                "paint",
                                "circle-stroke-color",
                                colord(color).toRgbString(),
                                {
                                  "s:color-auto": false,
                                }
                              );
                              context.updateLayer(
                                circleLayerIndex,
                                "paint",
                                "circle-stroke-opacity",
                                undefined,
                                {
                                  "s:color-auto": false,
                                }
                              );
                            }}
                          />
                          <div className="p-2 text-xs flex items-center text-white">
                            <Switch
                              onClick={(val) => {
                                if (val) {
                                  if (
                                    isExpression(
                                      circleLayer.paint?.["circle-color"]
                                    )
                                  ) {
                                    return;
                                  }
                                  const color = autoStrokeForFillColor(
                                    (circleLayer.paint?.[
                                      "circle-color"
                                    ] as string) || "#000000"
                                  );
                                  context.updateLayer(
                                    circleLayerIndex,
                                    "paint",
                                    "circle-stroke-color",
                                    color,
                                    {
                                      "s:color-auto": true,
                                    }
                                  );
                                } else {
                                  context.updateLayer(
                                    circleLayerIndex,
                                    undefined,
                                    undefined,
                                    undefined,
                                    {
                                      "s:color-auto": false,
                                    }
                                  );
                                }
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
              </div>
              <Popover.Arrow style={{ fill: "rgba(75, 85, 99)" }} />
            </Popover.Content>
          </Popover.Root>
        )}
      </Editor.Control>
    </Editor.Root>
  );
}
