import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { hasPlainPaintProp, isLineLayer } from "./SimplePolygonEditor";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import {
  findGetExpression,
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
import {
  CircleLayer,
  Expression,
  FillPaint,
  LineLayer,
  SymbolLayout,
  CirclePaint,
} from "mapbox-gl";
import {
  GeostatsLayer,
  NumericGeostatsAttribute,
  isLegacyGeostatsAttribute,
  isNumericGeostatsAttribute,
  isRasterInfo,
} from "@seasketch/geostats-types";
import AttributeSelect from "./AttributeSelect";
import {
  buildContinuousColorExpression,
  buildStepExpression,
  expressionMatchesPalette,
  extractColorsFromExpression,
  extractFirstColorFromExpression,
  extractValueRange,
  isCircleLayer,
  replaceColors,
  strokeExpressionFromFillExpression,
} from "./visualizationTypes";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { OpacityEditor } from "./OpacityEditor";
import { autoStrokeColorForFill } from "./FillStyleEditor";
import LabelLayerEditor, { isSymbolLayer } from "./LabelLayerEditor";
import Switch from "../../../components/Switch";
import PaletteSelect from "./PaletteSelect";
import HistogramControl from "./HistogramControl";
import ContinuousStepsEditor, { determineSteps } from "./ContinuousStepsEditor";

export default function ContinuousPointEditor() {
  const { t, glLayers, geostats, updateLayer } = useContext(
    Editor.GUIEditorContext
  );
  const indexes = useMemo(() => getIndexes(glLayers), [glLayers]);
  const layer = glLayers[indexes.circle] as CircleLayer | undefined;
  const selectedAttribute = useMemo(() => {
    if (
      layer?.paint?.["circle-color"] &&
      isExpression(layer.paint["circle-color"]) &&
      !isRasterInfo(geostats)
    ) {
      const attr = findGetExpression(layer.paint["circle-color"]);
      if (attr && attr.property) {
        return geostats.attributes.find((a) => a.attribute === attr.property);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexes.circle, geostats, layer?.paint?.["circle-color"]]);

  const steps =
    (layer?.paint || {})["circle-color"] &&
    selectedAttribute &&
    !isLegacyGeostatsAttribute(selectedAttribute) &&
    "stats" in selectedAttribute
      ? determineSteps(
          layer?.paint!["circle-color"]! as Expression,
          (selectedAttribute as NumericGeostatsAttribute).stats,
          layer?.metadata
        )
      : undefined;

  const range = useMemo(() => {
    return extractValueRange(
      (layer!.paint! as CirclePaint)["circle-color"] as Expression,
      Boolean(layer?.metadata?.["s:exclude-outside-range"])
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    layer?.paint?.["circle-color"],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Boolean(layer?.metadata?.["s:exclude-outside-range"]),
  ]);

  if (!layer) {
    return null;
  }
  return (
    <>
      <Editor.CardButtons>
        <LimitZoomTrigger
          minzoom={layer?.minzoom}
          maxzoom={layer?.maxzoom}
          updateLayerProperty={(...args) => {
            updateLayer(indexes.circle, ...args);
          }}
        />
      </Editor.CardButtons>
      <ZoomRangeEditor
        maxzoom={layer?.maxzoom}
        minzoom={layer?.minzoom}
        onChange={(min, max) => {
          if (indexes.circle !== -1) {
            updateLayer(indexes.circle, undefined, "minzoom", min);
            updateLayer(indexes.circle, undefined, "maxzoom", max);
          }
          // TODO: update circle-stroke?
          // if (indexes.stroke !== -1) {
          //   updateLayer(indexes.stroke, undefined, "minzoom", min);
          //   updateLayer(indexes.stroke, undefined, "maxzoom", max);
          // }
        }}
      />
      <OpacityEditor
        value={
          layer?.paint?.["circle-opacity"] as number | Expression | undefined
        }
        fillColor={extractFirstColorFromExpression(
          layer?.paint?.["circle-color"] as Expression
        )}
        onChange={(value) => {
          if (indexes.circle !== -1) {
            updateLayer(indexes.circle, "paint", "circle-opacity", value);
            updateLayer(
              indexes.circle,
              "paint",
              "circle-stroke-opacity",
              Math.min(value * 2, 1)
            );
          }
        }}
      />
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
              const metadata: Editor.SeaSketchLayerMetadata =
                layer?.metadata || {};
              if (layer) {
                // Clear s:exclude-outside-range and filters
                updateLayer(indexes.circle, "filter", undefined, undefined, {
                  "s:exclude-outside-range": false,
                });
                let fillExpr = buildContinuousColorExpression(
                  undefined,
                  metadata["s:palette"] || "interpolatePlasma",
                  metadata["s:reverse-palette"] || false,
                  [attribute.min || 0, attribute.max || 1],
                  ["get", attribute.attribute]
                ) as Expression;
                if (steps?.steps === "continuous") {
                  updateLayer(
                    indexes.circle,
                    "paint",
                    "circle-color",
                    fillExpr
                  );
                  updateLayer(
                    indexes.circle,
                    "paint",
                    "circle-color",
                    fillExpr,
                    {
                      ...metadata,
                      "s:palette": metadata["s:palette"] || "interpolatePlasma",
                    }
                  );
                } else if (isNumericGeostatsAttribute(attribute)) {
                  let buckets = (attribute.stats as any)[
                    steps?.steps as string
                  ][steps!.n];
                  let m = {};
                  if (!buckets || buckets.length === 0) {
                    // change to natural breaks
                    const nb = (attribute.stats as any).naturalBreaks;
                    if ("7" in nb) {
                      buckets = nb["7"];
                      m = {
                        "s:steps": "naturalBreaks:7",
                      };
                    } else {
                      const key = Object.keys(nb).pop();
                      buckets = nb[key!];
                      m = {
                        "s:steps": "naturalBreaks:" + key,
                      };
                    }
                  }
                  fillExpr = buildStepExpression(
                    buckets,
                    metadata["s:palette"] || "interpolatePlasma",
                    Boolean(metadata["s:reverse-palette"]),
                    ["get", attribute.attribute]
                  );
                  updateLayer(
                    indexes.circle,
                    "paint",
                    "circle-color",
                    fillExpr,
                    {
                      ...m,
                      "s:palette": metadata["s:palette"] || "interpolatePlasma",
                    }
                  );
                }
                updateLayer(
                  indexes.circle,
                  "paint",
                  "circle-stroke-color",
                  strokeExpressionFromFillExpression(fillExpr)
                );
                updateLayer(indexes.circle, "layout", "circle-sort-key", [
                  "get",
                  attribute.attribute,
                ]);
              }
            }}
          />
        </Editor.Control>
      </Editor.Root>
      {selectedAttribute && isNumericGeostatsAttribute(selectedAttribute) && (
        <ContinuousStepsEditor
          stats={(selectedAttribute as NumericGeostatsAttribute)?.stats}
          minimum={selectedAttribute.min || 0}
          maximum={selectedAttribute.max || 1}
          expression={layer?.paint?.["circle-color"] as Expression}
          metadata={layer?.metadata}
          updateLayerProperty={(type, property, value, metadata) => {
            updateLayer(indexes.circle, type, "circle-color", value, metadata);
            updateLayer(
              indexes.circle,
              type,
              "circle-stroke-color",
              strokeExpressionFromFillExpression(value)
            );
            // clear filters and s:exclude-outside-range
            updateLayer(indexes.circle, "filter", undefined, undefined, {
              "s:exclude-outside-range": false,
            });
          }}
          valueExpression={["get", selectedAttribute.attribute]}
        />
      )}
      <PaletteSelect
        steps={steps}
        type={"continuous"}
        reversed={layer?.metadata?.["s:reverse-palette"] || false}
        value={
          (layer?.metadata || {})["s:palette"] &&
          expressionMatchesPalette(
            layer?.paint?.["circle-color"]! as Expression,
            layer?.metadata["s:palette"],
            Boolean(layer?.metadata["s:reverse-palette"]),
            steps!
          )
            ? (layer?.metadata || {})["s:palette"]
            : null
        }
        onChange={(palette, reverse) => {
          const circleColorExpr = replaceColors(
            (layer!.paint! as CirclePaint)["circle-color"] as Expression,
            palette,
            Boolean(reverse),
            layer?.metadata?.["s:excluded"] || [],
            steps
          ) as Expression;
          const circleStrokeExpr =
            strokeExpressionFromFillExpression(circleColorExpr);
          updateLayer(
            indexes.circle,
            "paint",
            "circle-color",
            circleColorExpr,
            {
              "s:palette": palette,
              "s:reverse-palette": Boolean(reverse),
            }
          );
          updateLayer(
            indexes.circle,
            "paint",
            "circle-stroke-color",
            circleStrokeExpr
          );
        }}
      />
      <HistogramControl
        histogram={
          selectedAttribute &&
          !isLegacyGeostatsAttribute(selectedAttribute) &&
          "stats" in selectedAttribute
            ? // @ts-ignore
              selectedAttribute.stats!.histogram
            : []
        }
        expression={layer?.paint?.["circle-color"] as Expression}
        range={range}
        onRangeChange={(range, excludeOutsideRange) => {
          if (layer) {
            const fillExpression = layer.paint!["circle-color"] as Expression;
            let palette = layer.metadata?.["s:palette"] as any;
            if (
              !expressionMatchesPalette(
                fillExpression,
                palette,
                layer.metadata?.["s:reverse-palette"],
                steps!
              )
            ) {
              palette = extractColorsFromExpression(fillExpression);
            }
            const expr = buildContinuousColorExpression(
              fillExpression,
              palette,
              layer.metadata?.["s:reverse-palette"],
              range,
              ["get", selectedAttribute!.attribute]
            );
            updateLayer(indexes.circle, "paint", "circle-color", expr);
            const applyFilter =
              excludeOutsideRange &&
              (range[0] > selectedAttribute!.min! ||
                range[1] < selectedAttribute!.max!);
            updateLayer(
              indexes.circle,
              "filter",
              undefined,
              applyFilter
                ? [
                    "all",
                    [">=", ["get", selectedAttribute!.attribute], range[0]],
                    ["<=", ["get", selectedAttribute!.attribute], range[1]],
                  ]
                : undefined,
              {
                "s:exclude-outside-range": excludeOutsideRange,
              }
            );
            const strokeExpr = strokeExpressionFromFillExpression(
              expr as Expression
            );
            updateLayer(
              indexes.circle,
              "paint",
              "circle-stroke-color",
              strokeExpr
            );
          } else {
            throw new Error("No fill layer found");
          }
        }}
        excludeOutsideRange={
          layer.metadata?.["s:exclude-outside-range"] ||
          Array.isArray(layer.filter)
        }
      />
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
                ? (layer.metadata as Editor.SeaSketchLayerMetadata)?.[
                    "s:legend-labels"
                  ]?.[selectedAttribute?.attribute]
                : undefined
            }
            placeholder={selectedAttribute?.attribute}
            onValueChange={(value) => {
              if (selectedAttribute?.attribute) {
                updateLayer(indexes.circle, undefined, undefined, undefined, {
                  "s:legend-labels": {
                    ...((layer.metadata as Editor.SeaSketchLayerMetadata)?.[
                      "s:legend-labels"
                    ] || {}),
                    [selectedAttribute.attribute]: value,
                  },
                });
              }
            }}
          />
        </Editor.Control>
      </Editor.Root>
      <LabelLayerEditor />
    </>
  );
}

function getIndexes(glLayers: SeaSketchGlLayer[]) {
  return {
    circle: glLayers.findIndex(isCircleLayer),
    labels: glLayers.findIndex(
      (l) => isSymbolLayer(l) && hasGetExpression(l.layout?.["text-field"])
    ),
  };
}
