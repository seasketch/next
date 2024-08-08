import * as Editor from "./Editors";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { OpacityEditor } from "./OpacityEditor";
import { isCircleLayer } from "./visualizationTypes";
import {
  findGetExpression,
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
import { CircleLayer, Expression } from "mapbox-gl";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import CircleStrokeEditor from "./CircleStrokeEditor";
import { autoStrokeForFillColor } from "./FillStyleEditor";
import { useContext, useMemo } from "react";
import { isSymbolLayer } from "./LabelLayerEditor";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import AttributeSelect from "./AttributeSelect";
import * as Slider from "@radix-ui/react-slider";

export default function ProportionalSymbolEditor() {
  const context = useContext(Editor.GUIEditorContext);
  const { t } = context;

  const indexes = useMemo(() => {
    return {
      circle: context.glLayers.findIndex(isCircleLayer),
      labels: context.glLayers.findIndex(
        (l) => isSymbolLayer(l) && hasGetExpression(l.layout?.["text-field"])
      ),
    };
  }, [context.glLayers]);

  const circleLayer = context.glLayers[indexes.circle] as CircleLayer;

  const selectedAttribute = useMemo(() => {
    if (
      circleLayer?.paint?.["circle-radius"] &&
      isExpression(circleLayer.paint["circle-radius"]) &&
      !isRasterInfo(context.geostats)
    ) {
      const attr = findGetExpression(circleLayer.paint["circle-radius"]);
      if (attr && attr.property) {
        return context.geostats.attributes.find(
          (a) => a.attribute === attr.property
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexes.circle, context.geostats, circleLayer?.paint?.["circle-radius"]]);

  if (!circleLayer) {
    return null;
  }

  const geostats = context.geostats as GeostatsLayer;
  const circleRadiusExpression = circleLayer.paint?.[
    "circle-radius"
  ] as Expression;

  const Tooltip = Editor.Tooltip;

  return (
    <>
      <Editor.CardButtons>
        <LimitZoomTrigger
          minzoom={circleLayer.minzoom}
          maxzoom={circleLayer.maxzoom}
          updateLayerProperty={(...args) => {
            context.updateLayer(indexes.circle, ...args);
          }}
        />
      </Editor.CardButtons>
      <ZoomRangeEditor
        minzoom={circleLayer.minzoom}
        maxzoom={circleLayer.maxzoom}
        onChange={(min, max) => {
          if (indexes.circle !== -1) {
            context.updateLayer(indexes.circle, undefined, "minzoom", min);
            context.updateLayer(indexes.circle, undefined, "maxzoom", max);
          }
        }}
      />
      <OpacityEditor
        value={
          circleLayer.paint?.["circle-opacity"] as
            | number
            | Expression
            | undefined
        }
        fillColor={
          circleLayer.paint?.["circle-color"] &&
          !isExpression(circleLayer.paint["circle-color"])
            ? (circleLayer.paint?.["circle-color"] as string)
            : undefined
        }
        onChange={(value) => {
          if (indexes.circle !== -1) {
            context.updateLayer(
              indexes.circle,
              "paint",
              "circle-opacity",
              value
            );
            context.updateLayer(
              indexes.circle,
              "paint",
              "circle-stroke-opacity",
              Math.min(value * 2, 1)
            );
          }
        }}
      />
      <Editor.Root>
        <Editor.Label title={t("Color")} />
        <Editor.Control>
          {isExpression(circleLayer.paint?.["circle-color"]) ? (
            <Editor.CustomExpressionIndicator
              onClear={() => {
                context.updateLayer(
                  indexes.circle,
                  "paint",
                  "circle-color",
                  undefined
                );
              }}
            />
          ) : (
            <Editor.ColorPicker
              defaultColor="#000000"
              color={circleLayer.paint?.["circle-color"] as string | undefined}
              onChange={(color) => {
                context.updateLayer(
                  indexes.circle,
                  "paint",
                  "circle-color",
                  color
                );
                if (
                  (circleLayer.metadata as Editor.SeaSketchLayerMetadata)?.[
                    "s:color-auto"
                  ]
                ) {
                  const strokeColor = autoStrokeForFillColor(color);
                  context.updateLayer(
                    indexes.circle,
                    "paint",
                    "circle-stroke-color",
                    strokeColor
                  );
                }
              }}
            />
          )}
        </Editor.Control>
      </Editor.Root>
      <CircleStrokeEditor />
      <Editor.Root>
        <Editor.Label title={t("Style using field")} />
        <Editor.Control>
          <AttributeSelect
            attributes={(geostats as GeostatsLayer).attributes.filter(
              (a) => a.type === "number" && Object.keys(a.values).length > 1
            )}
            value={selectedAttribute?.attribute}
            onChange={(attr) => {
              const attribute = (geostats as GeostatsLayer).attributes.find(
                (a) => a.attribute === attr
              );
              if (!attribute) {
                throw new Error("Attribute not found");
              }
              if (circleLayer && indexes.circle !== -1) {
                const circleRadiusExpression = [
                  "interpolate",
                  ["linear"],
                  ["get", attribute.attribute],
                  attribute.min || 0,
                  5,
                  attribute.max || 100,
                  50,
                ];
                context.updateLayer(
                  indexes.circle,
                  "paint",
                  "circle-radius",
                  circleRadiusExpression
                );
              }
            }}
          />
        </Editor.Control>
      </Editor.Root>
      <Editor.Root>
        <Editor.Label title={t("Size")} />
        <Editor.Control>
          <Tooltip.Provider>
            <Slider.Root
              className="relative flex items-center select-none touch-none w-44 h-5"
              value={[circleRadiusExpression[4], circleRadiusExpression[6]]}
              min={1}
              max={100}
              step={1}
              minStepsBetweenThumbs={1}
              onValueChange={(v) => {
                // onChange(v[0], v[1]);
                const [min, max] = v;
                if (indexes.circle !== -1) {
                  const newExpression = [
                    "interpolate",
                    ["linear"],
                    ["get", selectedAttribute?.attribute],
                    selectedAttribute?.min || 0,
                    min,
                    selectedAttribute?.max || 100,
                    max,
                  ];
                  context.updateLayer(
                    indexes.circle,
                    "paint",
                    "circle-radius",
                    newExpression
                  );
                }
              }}
            >
              <Slider.Track className="bg-gray-800 bg-opacity-90 border-b border-gray-600  relative grow rounded h-1 w-full">
                <Slider.Range className="absolute bg-indigo-500 rounded h-full" />
              </Slider.Track>
              <Tooltip.Root delayDuration={0} open>
                <Tooltip.Trigger
                  asChild
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => e.preventDefault()}
                >
                  <Slider.Thumb
                    className={`block w-3 h-5 rounded bg-gray-300  shadow hover:bg-gray-100 focus:outline-none focus:shadow`}
                    style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.5)" }}
                    aria-label={"min size"}
                  />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="bottom"
                    sideOffset={5}
                    className="py-0.5 opacity-50"
                  >
                    <span className="">{circleRadiusExpression[4] + "px"}</span>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
              <Tooltip.Root delayDuration={0} open>
                <Tooltip.Trigger asChild>
                  <Slider.Thumb
                    className={`block w-3 h-5 rounded bg-gray-300  shadow hover:bg-gray-100 focus:outline-none focus:shadow`}
                    style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.5)" }}
                    aria-label={"max size"}
                  />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="bottom"
                    sideOffset={5}
                    className="py-0.5 opacity-50"
                  >
                    <span>{circleRadiusExpression[6] + "px"}</span>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Slider.Root>
          </Tooltip.Provider>
        </Editor.Control>
      </Editor.Root>
      <Editor.Header title={t("Legend")} className="pt-6" />
      <Editor.Root>
        <Editor.Label
          title={t("Value Label")}
          tooltip={t("Labels the color scale. Use a space to hide.")}
        />
        <Editor.Control>
          <Editor.TextInput
            className="text-right w-32"
            value={
              selectedAttribute?.attribute
                ? (circleLayer.metadata as Editor.SeaSketchLayerMetadata)?.[
                    "s:legend-labels"
                  ]?.[selectedAttribute?.attribute]
                : undefined
            }
            placeholder={selectedAttribute?.attribute}
            onValueChange={(value) => {
              if (selectedAttribute?.attribute) {
                context.updateLayer(
                  indexes.circle,
                  undefined,
                  undefined,
                  undefined,
                  {
                    "s:legend-labels": {
                      ...((
                        circleLayer.metadata as Editor.SeaSketchLayerMetadata
                      )?.["s:legend-labels"] || {}),
                      [selectedAttribute.attribute]: value,
                    },
                  }
                );
              }
            }}
          />
        </Editor.Control>
      </Editor.Root>
    </>
  );
}

ProportionalSymbolEditor.hasUnrelatedLayers = (
  glLayers: SeaSketchGlLayer[]
) => {
  return glLayers.length > 1;
};
