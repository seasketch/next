import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import {
  findGetExpression,
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
import * as Editor from "./Editors";
import { useCallback, useContext, useMemo } from "react";
import {
  buildMatchExpressionForAttribute,
  categoricalAttributes,
  expressionMatchesPalette,
  extractFirstColorFromExpression,
  isCircleLayer,
  strokeExpressionFromFillExpression,
} from "./visualizationTypes";
import LabelLayerEditor, { isSymbolLayer } from "./LabelLayerEditor";
import { StepsSetting } from "./ContinuousStepsEditor";
import { CircleLayer, Expression } from "mapbox-gl";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { OpacityEditor } from "./OpacityEditor";
import AttributeSelect from "./AttributeSelect";
import PaletteSelect from "./PaletteSelect";
import { CategoryEditableList } from "./CategoryEditableList";

const steps = { steps: "manual", n: 0 } as StepsSetting;

export default function CategoricalPointEditor() {
  const { t, glLayers, geostats, updateLayer } = useContext(
    Editor.GUIEditorContext
  );
  const indexes = useMemo(() => getIndexes(glLayers), [glLayers]);
  const circleLayer = (glLayers[indexes.circles] as CircleLayer) || undefined;

  const selectedAttribute = useMemo(() => {
    if (
      circleLayer?.paint?.["circle-color"] &&
      isExpression(circleLayer.paint["circle-color"]) &&
      !isRasterInfo(geostats)
    ) {
      const attr = findGetExpression(circleLayer.paint["circle-color"]);
      if (attr && attr.property) {
        return geostats.attributes.find((a) => a.attribute === attr.property);
      }
    }
  }, [indexes.circles, geostats, circleLayer?.paint?.["circle-color"]]);

  const onPaletteChange = useCallback(
    (palette, reverse) => {
      if (!selectedAttribute) {
        throw new Error("No attribute selected");
      }
      const fillExpression = buildMatchExpressionForAttribute(
        selectedAttribute,
        palette,
        Boolean(reverse)
      );
      updateLayer(indexes.circles, "paint", "circle-color", fillExpression, {
        "s:palette": palette,
        "s:reverse-palette": Boolean(reverse),
      });
      // TODO: create stroke color expression based on fill expression
      updateLayer(
        indexes.circles,
        "paint",
        "circle-stroke-color",
        strokeExpressionFromFillExpression(fillExpression)
      );
    },
    [indexes.circles, selectedAttribute, updateLayer]
  );

  const onCategoriesChange = useCallback(
    (expression, metadata) => {
      if (indexes.circles !== -1) {
        updateLayer(
          indexes.circles,
          "paint",
          "circle-color",
          expression,
          metadata
        );
        updateLayer(
          indexes.circles,
          "paint",
          "circle-stroke-color",
          strokeExpressionFromFillExpression(expression)
        );
      }
    },
    [updateLayer, indexes.circles]
  );

  if (!circleLayer) {
    return null;
  }

  return (
    <>
      <Editor.CardButtons>
        <LimitZoomTrigger
          minzoom={circleLayer?.minzoom}
          maxzoom={circleLayer?.maxzoom}
          updateLayerProperty={(...args) => {
            updateLayer(indexes.circles, ...args);
          }}
        />
      </Editor.CardButtons>
      <ZoomRangeEditor
        maxzoom={circleLayer?.maxzoom}
        minzoom={circleLayer?.minzoom}
        onChange={(min, max) => {
          if (indexes.circles !== -1) {
            updateLayer(indexes.circles, undefined, "minzoom", min);
            updateLayer(indexes.circles, undefined, "maxzoom", max);
          }
        }}
      />
      <OpacityEditor
        value={
          circleLayer?.paint?.["circle-opacity"] as
            | number
            | Expression
            | undefined
        }
        fillColor={extractFirstColorFromExpression(
          circleLayer?.paint?.["circle-color"] as Expression
        )}
        onChange={(value) => {
          if (indexes.circles !== -1) {
            updateLayer(indexes.circles, "paint", "circle-opacity", value);
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
                circleLayer?.metadata || {};
              if (circleLayer) {
                updateLayer(
                  indexes.circles,
                  "paint",
                  "circle-color",
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
        reversed={circleLayer?.metadata?.["s:reverse-palette"] || false}
        value={
          (circleLayer?.metadata || {})["s:palette"] &&
          expressionMatchesPalette(
            circleLayer?.paint?.["circle-color"]! as Expression,
            circleLayer?.metadata["s:palette"],
            Boolean(circleLayer?.metadata["s:reverse-palette"]),
            steps
          )
            ? (circleLayer?.metadata || {})["s:palette"]
            : null
        }
        onChange={onPaletteChange}
      />
      <CategoryEditableList
        expression={circleLayer?.paint?.["circle-color"] as Expression}
        metadata={circleLayer?.metadata}
        onChange={onCategoriesChange}
      />
      {circleLayer && (
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
                    ? (circleLayer.metadata as Editor.SeaSketchLayerMetadata)?.[
                        "s:legend-labels"
                      ]?.[selectedAttribute?.attribute]
                    : undefined
                }
                placeholder={selectedAttribute?.attribute}
                onValueChange={(value) => {
                  if (selectedAttribute?.attribute) {
                    updateLayer(
                      indexes.circles,
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
          <LabelLayerEditor />
        </>
      )}
    </>
  );
}

function getIndexes(layers: SeaSketchGlLayer[]) {
  return {
    circles: layers.findIndex(
      (l) => isCircleLayer(l) && hasGetExpression(l.paint?.["circle-color"])
    ),
    labels: layers.findIndex(
      (l) => isSymbolLayer(l) && l.layout?.["text-field"] !== undefined
    ),
  };
}
