import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import * as Editor from "./Editors";
import { useCallback, useContext, useMemo } from "react";
import { isFillLayer, isLineLayer } from "./SimplePolygonEditor";
import {
  findGetExpression,
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
import { Expression, FillLayer, SymbolLayout } from "mapbox-gl";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import { OpacityEditor } from "./OpacityEditor";
import {
  buildMatchExpressionForAttribute,
  categoricalAttributes,
  expressionMatchesPalette,
  extractFirstColorFromExpression,
} from "./visualizationTypes";
import AttributeSelect from "./AttributeSelect";
import PaletteSelect from "./PaletteSelect";
import { CategoryEditableList } from "./CategoryEditableList";
import { StepsSetting } from "./ContinuousStepsEditor";
import LabelLayerEditor, { isSymbolLayer } from "./LabelLayerEditor";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";

const steps = { steps: "manual", n: 0 } as StepsSetting;

export default function CategoricalPolygonEditor() {
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
  }, [indexes.fill, geostats, fillLayer?.paint?.["fill-color"]]);

  const onCategoriesChange = useCallback(
    (expression, metadata) => {
      if (indexes.fill !== -1) {
        updateLayer(indexes.fill, "paint", "fill-color", expression, metadata);
      }
    },
    [updateLayer, indexes.fill]
  );

  const onPaletteChange = useCallback(
    (palette, reverse) => {
      if (!selectedAttribute) {
        throw new Error("No attribute selected");
      }
      updateLayer(
        indexes.fill,
        "paint",
        "fill-color",
        buildMatchExpressionForAttribute(
          selectedAttribute,
          palette,
          Boolean(reverse)
        ),
        {
          "s:palette": palette,
          "s:reverse-palette": Boolean(reverse),
        }
      );
    },
    [indexes.fill, selectedAttribute, updateLayer]
  );

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
            updateLayer(indexes.fill, "paint", "fill-opacity", value);
          }
          if (indexes.stroke !== -1) {
            updateLayer(
              indexes.stroke,
              "paint",
              "line-opacity",
              indexes.fill === -1 ? value : Math.min(value * 2, 1)
            );
          }
        }}
      />
      <Editor.Root>
        <Editor.Label title={t("Categorize using field")} />
        <Editor.Control>
          <AttributeSelect
            attributes={categoricalAttributes(
              (geostats as GeostatsLayer).attributes
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
                updateLayer(
                  indexes.fill,
                  "paint",
                  "fill-color",
                  buildMatchExpressionForAttribute(
                    attribute,
                    metadata["s:palette"] || "schemeTableau10",
                    metadata["s:reverse-palette"] || false
                  )
                );
              }
            }}
          />
        </Editor.Control>
      </Editor.Root>
      <PaletteSelect
        steps={steps}
        type={"categorical"}
        reversed={fillLayer?.metadata?.["s:reverse-palette"] || false}
        value={
          (fillLayer?.metadata || {})["s:palette"] &&
          expressionMatchesPalette(
            fillLayer?.paint?.["fill-color"]! as Expression,
            fillLayer?.metadata["s:palette"],
            Boolean(fillLayer?.metadata["s:reverse-palette"]),
            steps
          )
            ? (fillLayer?.metadata || {})["s:palette"]
            : null
        }
        onChange={onPaletteChange}
      />
      <CategoryEditableList
        expression={fillLayer?.paint?.["fill-color"] as Expression}
        metadata={fillLayer?.metadata}
        onChange={onCategoriesChange}
      />
      {fillLayer && (
        <>
          <Editor.Header title={t("Legend")} className="pt-6" />
          <Editor.Root>
            <Editor.Label
              title={t("Value Label")}
              tooltip={t(
                "Label appears above categories. Enter a space to hide."
              )}
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
        </>
      )}
      <LabelLayerEditor />
    </>
  );
}

CategoricalPolygonEditor.hasUnrelatedLayers = (
  glLayers: SeaSketchGlLayer[]
) => {
  return (
    glLayers.filter((l) => isFillLayer(l)).length > 1 ||
    glLayers.filter((l) => isLineLayer(l)).length > 1 ||
    glLayers.filter((l) => isSymbolLayer(l) && l.layout?.["text-field"])
      .length > 1
  );
};

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
      indexes.fill = i;
    } else if (
      indexes.stroke === -1 &&
      isLineLayer(layer) &&
      hasGetExpression(layer.paint?.["line-color"])
    ) {
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
