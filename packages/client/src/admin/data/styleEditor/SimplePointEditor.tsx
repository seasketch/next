import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { OpacityEditor } from "./OpacityEditor";
import LabelLayerEditor, { isSymbolLayer } from "./LabelLayerEditor";
import { useTranslation } from "react-i18next";
import { isCircleLayer } from "./visualizationTypes";
import {
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
import { CircleLayer, Expression } from "mapbox-gl";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";

export default function SimplePointEditor() {
  const context = useContext(Editor.GUIEditorContext);
  const { t } = useTranslation("admin:data");

  const indexes = useMemo(() => {
    return {
      circle: context.glLayers.findIndex(isCircleLayer),
      labels: context.glLayers.findIndex(
        (l) => isSymbolLayer(l) && hasGetExpression(l.layout?.["text-field"])
      ),
    };
  }, [context.glLayers]);

  const circleLayer = context.glLayers[indexes.circle] as CircleLayer;

  if (!circleLayer) {
    return null;
  }

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
          }
        }}
      />
      <Editor.Root>
        <Editor.Label title={t("Circle Color")} />
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
              }}
            />
          )}
        </Editor.Control>
      </Editor.Root>
      {/* TODO: Circle Stroke (color and width) */}
      <Editor.Root>
        <Editor.Label title={t("Circle Radius")} />
        <Editor.Control>
          {isExpression(circleLayer.paint?.["circle-radius"]) ? (
            <Editor.CustomExpressionIndicator
              onClear={() => {
                context.updateLayer(
                  indexes.circle,
                  "paint",
                  "circle-radius",
                  undefined
                );
              }}
            />
          ) : (
            <Editor.NumberSliderAndInput
              max={30}
              min={1}
              step={1}
              value={(circleLayer.paint?.["circle-radius"] as number) || 1}
              onChange={(number) => {
                context.updateLayer(
                  indexes.circle,
                  "paint",
                  "circle-radius",
                  number
                );
              }}
            />
          )}
        </Editor.Control>
      </Editor.Root>
      <LabelLayerEditor />
    </>
  );
}

SimplePointEditor.hasUnrelatedLayers = (layers: SeaSketchGlLayer[]) => {
  const circleLayer = layers.find(isCircleLayer);
  const labelLayer = layers.find(
    (l) => isSymbolLayer(l) && hasGetExpression(l.layout?.["text-field"])
  );
  if (labelLayer && circleLayer && layers.length > 2) {
    return true;
  } else if ((!labelLayer || !circleLayer) && layers.length > 1) {
    return true;
  }
};
