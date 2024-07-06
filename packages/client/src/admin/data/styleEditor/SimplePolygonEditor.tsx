import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { useTranslation } from "react-i18next";
import {
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
import { FillLayer, Layer, LineLayer } from "mapbox-gl";
import { OpacityEditor } from "./OpacityEditor";
import FillStyleEditor, { autoStrokeColorForFill } from "./FillStyleEditor";
import StrokeEditor from "./StrokeEditor";

export default function SimplePolygonEditor() {
  const context = useContext(Editor.GUIEditorContext);
  const { t } = useTranslation("admin:data");

  const indexes = useMemo(() => {
    const indexes = {
      fill: -1,
      stroke: -1,
      labels: -1,
    };
    for (var i = 0; i < context.glLayers.length; i++) {
      const layer = context.glLayers[i];
      if (
        indexes.fill === -1 &&
        isFillLayer(layer) &&
        hasPlainPaintProp(layer, "fill-color")
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
      } else if (layer.type === "symbol") {
        indexes.labels = i;
      }
    }
    if (indexes.fill === -1) {
      for (var i = 0; i < context.glLayers.length; i++) {
        const layer = context.glLayers[i];
        if (isFillLayer(layer)) {
          indexes.fill = i;
          break;
        }
      }
    }
    if (indexes.stroke === -1) {
      for (var i = 0; i < context.glLayers.length; i++) {
        const layer = context.glLayers[i];
        if (isLineLayer(layer)) {
          indexes.stroke = i;
          break;
        }
      }
    }
    return indexes;
  }, [context.glLayers]);

  const fillLayer = context.glLayers[indexes.fill] as FillLayer | undefined;
  const strokeLayer =
    indexes.stroke !== -1
      ? (context.glLayers[indexes.stroke] as LineLayer)
      : undefined;

  const opacity = useMemo(() => {
    const opacity = {
      isCustomExpression: false,
      value: 1,
    };
    if (fillLayer?.paint?.["fill-opacity"] !== undefined) {
      opacity.value = fillLayer.paint["fill-opacity"] as number;
      opacity.isCustomExpression = isExpression(
        fillLayer.paint["fill-opacity"]
      );
    } else if (strokeLayer?.paint?.["line-opacity"] !== undefined) {
      opacity.value = strokeLayer.paint["line-opacity"] as number;
      opacity.isCustomExpression = isExpression(
        strokeLayer.paint["line-opacity"]
      );
    }
    return opacity;
  }, [
    fillLayer?.paint?.["fill-opacity"],
    strokeLayer?.paint?.["line-opacity"],
  ]);

  return (
    <Editor.Card>
      <Editor.CardTitle
        buttons={
          <LimitZoomTrigger
            minzoom={fillLayer?.minzoom || strokeLayer?.minzoom}
            maxzoom={fillLayer?.maxzoom || strokeLayer?.maxzoom}
            updateLayerProperty={(...args) => {
              context.updateLayer(indexes.fill, ...args);
            }}
          />
        }
      >
        {t("Simple Polygon")}
      </Editor.CardTitle>
      <ZoomRangeEditor
        maxzoom={fillLayer?.maxzoom || strokeLayer?.maxzoom}
        minzoom={fillLayer?.minzoom || strokeLayer?.minzoom}
        onChange={(min, max) => {
          if (indexes.fill !== -1) {
            context.updateLayer(indexes.fill, undefined, "minzoom", min);
            context.updateLayer(indexes.fill, undefined, "maxzoom", max);
          }
          if (indexes.stroke !== -1) {
            context.updateLayer(indexes.stroke, undefined, "minzoom", min);
            context.updateLayer(indexes.stroke, undefined, "maxzoom", max);
          }
        }}
      />
      {opacity.isCustomExpression && (
        <Editor.Root>
          <Editor.Label title={t("Opacity")} />
          <Editor.Control>
            <Editor.CustomExpressionIndicator />
          </Editor.Control>
        </Editor.Root>
      )}
      {!opacity.isCustomExpression && (
        <OpacityEditor
          value={opacity.value}
          fillColor={
            fillLayer?.paint?.["fill-color"] &&
            !isExpression(fillLayer.paint["fill-color"])
              ? (fillLayer?.paint?.["fill-color"] as string)
              : undefined
          }
          onChange={(value) => {
            if (indexes.fill !== -1) {
              context.updateLayer(indexes.fill, "paint", "fill-opacity", value);
            }
            if (indexes.stroke !== -1) {
              context.updateLayer(
                indexes.stroke,
                "paint",
                "line-opacity",
                indexes.fill === -1 ? value : Math.min(value * 2, 1)
              );
              const newStrokeColor = autoStrokeColorForFill(
                context.glLayers[indexes.fill] as FillLayer,
                context.glLayers[indexes.stroke] as LineLayer
              );
              const line = context.glLayers[indexes.stroke] as LineLayer;
              if (
                line.paint &&
                line.paint["line-color"] &&
                line.paint["line-color"] !== newStrokeColor
              ) {
                context.updateLayer(
                  indexes.stroke,
                  "paint",
                  "line-color",
                  newStrokeColor
                );
              }
            }
          }}
        />
      )}
      <FillStyleEditor layer={context.glLayers[indexes.fill]} />
      <StrokeEditor
        layer={context.glLayers[indexes.stroke] as LineLayer}
        fillLayer={context.glLayers[indexes.fill] as FillLayer}
      />
    </Editor.Card>
  );
}

export function isLineLayer(layer: Pick<Layer, "type">): layer is LineLayer {
  return layer.type === "line";
}

export function isFillLayer(layer: Pick<Layer, "type">): layer is FillLayer {
  return layer.type === "fill";
}

export function hasPlainPaintProp(layer: Layer, prop: string) {
  return (
    (layer.paint as any)?.[prop] &&
    !hasGetExpression((layer.paint as any)[prop])
  );
}
