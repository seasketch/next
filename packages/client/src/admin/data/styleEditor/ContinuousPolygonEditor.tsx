import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import {
  hasPlainPaintProp,
  isFillLayer,
  isLineLayer,
} from "./SimplePolygonEditor";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import {
  findGetExpression,
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
import {
  Expression,
  FillLayer,
  FillPaint,
  LineLayer,
  SymbolLayout,
} from "mapbox-gl";
import {
  GeostatsLayer,
  NumericAttributeStats,
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
  replaceColors,
} from "./visualizationTypes";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { OpacityEditor } from "./OpacityEditor";
import { autoStrokeColorForFill } from "./FillStyleEditor";
import LabelLayerEditor, { isSymbolLayer } from "./LabelLayerEditor";
import Switch from "../../../components/Switch";
import PaletteSelect from "./PaletteSelect";
import HistogramControl from "./HistogramControl";
import ContinuousStepsEditor, { determineSteps } from "./ContinuousStepsEditor";

export default function ContinuousPolygonEditor() {
  const { t, glLayers, geostats, updateLayer } = useContext(
    Editor.GUIEditorContext
  );
  const indexes = useMemo(() => getIndexes(glLayers), [glLayers]);
  const fillLayer = glLayers[indexes.fill] as
    | (FillLayer & { metadata: Editor.SeaSketchLayerMetadata })
    | undefined;
  const selectedAttribute = useMemo(() => {
    if (
      fillLayer?.paint?.["fill-color"] &&
      isExpression(fillLayer.paint["fill-color"]) &&
      !isRasterInfo(geostats)
    ) {
      const attr = findGetExpression(fillLayer.paint["fill-color"]);
      if (attr && attr.property) {
        return geostats.attributes.find((a) => a.attribute === attr.property);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexes.fill, geostats, fillLayer?.paint?.["fill-color"]]);

  const steps =
    (fillLayer?.paint || {})["fill-color"] &&
    selectedAttribute &&
    !isLegacyGeostatsAttribute(selectedAttribute) &&
    "stats" in selectedAttribute
      ? determineSteps(
          fillLayer?.paint!["fill-color"]! as Expression,
          selectedAttribute.stats as NumericAttributeStats,
          fillLayer?.metadata
        )
      : undefined;

  const range = useMemo(() => {
    return extractValueRange(
      (fillLayer!.paint! as FillPaint)["fill-color"] as Expression
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillLayer?.paint?.["fill-color"]]);

  return (
    <>
      <Editor.CardButtons>
        <LimitZoomTrigger
          minzoom={fillLayer?.minzoom}
          maxzoom={fillLayer?.maxzoom}
          updateLayerProperty={(...args) => {
            updateLayer(indexes.fill, ...args);
          }}
        />
      </Editor.CardButtons>
      <ZoomRangeEditor
        maxzoom={fillLayer?.maxzoom}
        minzoom={fillLayer?.minzoom}
        onChange={(min, max) => {
          if (indexes.fill !== -1) {
            updateLayer(indexes.fill, undefined, "minzoom", min);
            updateLayer(indexes.fill, undefined, "maxzoom", max);
          }
          if (indexes.stroke !== -1) {
            updateLayer(indexes.stroke, undefined, "minzoom", min);
            updateLayer(indexes.stroke, undefined, "maxzoom", max);
          }
        }}
      />
      <OpacityEditor
        value={
          fillLayer?.paint?.["fill-opacity"] as number | Expression | undefined
        }
        fillColor={extractFirstColorFromExpression(
          fillLayer?.paint?.["fill-color"] as Expression
        )}
        onChange={(value) => {
          if (indexes.fill !== -1) {
            console.log("updating", indexes.fill, value);
            updateLayer(indexes.fill, "paint", "fill-opacity", value);
          }
          if (indexes.stroke !== -1) {
            updateLayer(
              indexes.stroke,
              "paint",
              "line-opacity",
              indexes.fill === -1 ? value : Math.min(value * 2, 1)
            );
            const newStrokeColor = autoStrokeColorForFill(
              glLayers[indexes.fill] as FillLayer,
              glLayers[indexes.stroke] as LineLayer
            );
            const line = glLayers[indexes.stroke] as LineLayer;
            if (
              line.paint &&
              line.paint["line-color"] &&
              line.paint["line-color"] !== newStrokeColor
            ) {
              updateLayer(
                indexes.stroke,
                "paint",
                "line-color",
                newStrokeColor
              );
            }
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
                fillLayer?.metadata || {};
              if (fillLayer) {
                if (steps?.steps === "continuous") {
                  updateLayer(
                    indexes.fill,
                    "paint",
                    "fill-color",
                    buildContinuousColorExpression(
                      undefined,
                      metadata["s:palette"] || "interpolatePlasma",
                      metadata["s:reverse-palette"] || false,
                      [attribute.min || 0, attribute.max || 1],
                      ["get", attribute.attribute]
                    )
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
                  updateLayer(
                    indexes.fill,
                    "paint",
                    "fill-color",
                    buildStepExpression(
                      buckets,
                      metadata["s:palette"] || "interpolatePlasma",
                      Boolean(metadata["s:reverse-palette"]),
                      ["get", attribute.attribute]
                    ),
                    {
                      ...m,
                      "s:palette": metadata["s:palette"] || "interpolatePlasma",
                    }
                  );
                }
              }
            }}
          />
        </Editor.Control>
      </Editor.Root>
      {isNumericGeostatsAttribute(selectedAttribute) && (
        <ContinuousStepsEditor
          stats={selectedAttribute?.stats as NumericAttributeStats}
          minimum={selectedAttribute.min || 0}
          maximum={selectedAttribute.max || 1}
          expression={fillLayer?.paint?.["fill-color"] as Expression}
          metadata={fillLayer?.metadata}
          updateLayerProperty={(type, property, value, metadata) => {
            updateLayer(indexes.fill, type, "fill-color", value, metadata);
          }}
          valueExpression={["get", selectedAttribute.attribute]}
        />
      )}
      <PaletteSelect
        steps={steps}
        type={"continuous"}
        reversed={fillLayer?.metadata?.["s:reverse-palette"] || false}
        value={
          (fillLayer?.metadata || {})["s:palette"] &&
          expressionMatchesPalette(
            fillLayer?.paint?.["fill-color"]! as Expression,
            fillLayer?.metadata["s:palette"],
            Boolean(fillLayer?.metadata["s:reverse-palette"]),
            steps!
          )
            ? (fillLayer?.metadata || {})["s:palette"]
            : null
        }
        onChange={(palette, reverse) => {
          updateLayer(
            indexes.fill,
            "paint",
            "fill-color",
            replaceColors(
              (fillLayer!.paint! as FillPaint)["fill-color"] as Expression,
              palette,
              Boolean(reverse),
              fillLayer?.metadata?.["s:excluded"] || [],
              steps
            ),
            {
              "s:palette": palette,
              "s:reverse-palette": Boolean(reverse),
            }
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
        expression={fillLayer?.paint?.["fill-color"] as Expression}
        range={range}
        onRangeChange={(range) => {
          if (fillLayer) {
            const fillExpression = fillLayer.paint!["fill-color"] as Expression;
            let palette = fillLayer.metadata?.["s:palette"] as any;
            if (
              !expressionMatchesPalette(
                fillExpression,
                palette,
                fillLayer.metadata?.["s:reverse-palette"],
                steps!
              )
            ) {
              palette = extractColorsFromExpression(fillExpression);
            }
            const expr = buildContinuousColorExpression(
              fillExpression,
              palette,
              fillLayer.metadata?.["s:reverse-palette"],
              range,
              ["get", selectedAttribute!.attribute]
            );
            updateLayer(indexes.fill, "paint", "fill-color", expr);
          } else {
            throw new Error("No fill layer found");
          }
        }}
      />
      {fillLayer && (
        <>
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
                    ? (fillLayer.metadata as Editor.SeaSketchLayerMetadata)?.[
                        "s:legend-labels"
                      ]?.[selectedAttribute?.attribute]
                    : undefined
                }
                placeholder={selectedAttribute?.attribute}
                onValueChange={(value) => {
                  if (selectedAttribute?.attribute) {
                    updateLayer(indexes.fill, undefined, undefined, undefined, {
                      "s:legend-labels": {
                        ...((
                          fillLayer.metadata as Editor.SeaSketchLayerMetadata
                        )?.["s:legend-labels"] || {}),
                        [selectedAttribute.attribute]: value,
                      },
                    });
                  }
                }}
              />
            </Editor.Control>
          </Editor.Root>
          <Editor.Root>
            <Editor.Label title={t("Display rounded numbers")} />
            <Editor.Control>
              <Switch
                toggleColor={"rgba(79, 70, 229)"}
                className="focus:ring-blue-600"
                isToggled={fillLayer.metadata?.["s:round-numbers"] || false}
                onClick={(value) => {
                  updateLayer(indexes.fill, undefined, undefined, undefined, {
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
                value={fillLayer.metadata?.["s:value-suffix"] || ""}
                onValueChange={(v) => {
                  updateLayer(indexes.fill, undefined, undefined, undefined, {
                    "s:value-suffix": v,
                  });
                }}
              />
            </Editor.Control>
          </Editor.Root>
        </>
      )}
      <LabelLayerEditor />
    </>
  );
}

export function getIndexes(glLayers: SeaSketchGlLayer[]) {
  const indexes = {
    fill: -1,
    stroke: -1,
    labels: -1,
  };
  for (var i = 0; i < glLayers.length; i++) {
    const layer = glLayers[i];
    if (
      indexes.fill === -1 &&
      isFillLayer(layer) &&
      hasGetExpression(layer.paint?.["fill-color"])
    ) {
      // skip over in case there is another fill that is plain
      indexes.fill = i;
    } else if (
      indexes.stroke === -1 &&
      isLineLayer(layer) &&
      hasPlainPaintProp(layer, "line-color")
    ) {
      // skip over in case there is another line that is plain
      indexes.stroke = i;
    } else if (
      layer.type === "symbol" &&
      (layer.layout as SymbolLayout)?.["text-field"]
    ) {
      indexes.labels = i;
    }
  }
  if (indexes.stroke === -1) {
    for (var j = 0; j < glLayers.length; j++) {
      const layer = glLayers[j];
      if (isLineLayer(layer)) {
        indexes.stroke = j;
        break;
      }
    }
  }
  return indexes;
}

ContinuousPolygonEditor.hasUnrelatedLayers = (layers: SeaSketchGlLayer[]) => {
  if (layers.filter((l) => isFillLayer(l)).length > 1) {
    return true;
  } else if (layers.filter((l) => isLineLayer(l)).length > 1) {
    return true;
  } else if (layers.filter((l) => l.type === "symbol").length > 1) {
    return true;
  }
  if (layers.find((l) => isSymbolLayer(l) && !l.layout?.["text-field"])) {
    return true;
  }
  if (
    layers.find(
      (l) => l.type !== "fill" && l.type !== "line" && l.type !== "symbol"
    )
  ) {
    return true;
  }
  return false;
};
