import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { useTranslation } from "react-i18next";
import {
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
import { FillLayer, Layer, LineLayer, LinePaint } from "mapbox-gl";
import { OpacityEditor } from "./OpacityEditor";
import StrokeStyleEditor from "./StrokeStyleEditor";
export default function SimplePolygonEditor() {
  const context = useContext(Editor.GUIEditorContext);
  const { t } = useTranslation("admin:data");

  const indexes = useMemo(() => {
    const indexes = {
      fill: -1,
      stroke: -1,
      labels: -1,
    };
    for (const [i, layer] of context.glLayers.entries()) {
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
      for (const [i, layer] of context.glLayers.entries()) {
        if (isFillLayer(layer)) {
          indexes.fill = i;
          break;
        }
      }
    }
    if (indexes.stroke === -1) {
      for (const [i, layer] of context.glLayers.entries()) {
        if (isLineLayer(layer)) {
          indexes.stroke = i;
          break;
        }
      }
    }
    if (indexes.fill === -1) {
      throw new Error("No fill layer found");
    }
    return indexes;
  }, [context.glLayers]);

  const fillLayer = context.glLayers[indexes.fill] as FillLayer;

  return (
    <Editor.Card>
      <Editor.CardTitle
        buttons={
          <LimitZoomTrigger
            minzoom={fillLayer.minzoom}
            maxzoom={fillLayer.maxzoom}
            updateLayerProperty={(...args) => {
              context.updateLayer(indexes.fill, ...args);
            }}
          />
        }
      >
        {t("Simple Polygon")}
      </Editor.CardTitle>
      <ZoomRangeEditor
        maxzoom={fillLayer.maxzoom}
        minzoom={fillLayer.minzoom}
        onChange={(min, max) => {
          context.updateLayer(indexes.fill, undefined, "minzoom", min);
          context.updateLayer(indexes.fill, undefined, "maxzoom", max);
        }}
      />
      <OpacityEditor
        value={
          (fillLayer.paint?.["fill-opacity"] &&
          !isExpression(fillLayer.paint?.["fill-opacity"])
            ? fillLayer.paint?.["fill-opacity"]
            : 1) as number
        }
        onChange={(value) => {
          context.updateLayer(indexes.fill, "paint", "fill-opacity", value);
          if (indexes.stroke !== -1) {
            context.updateLayer(
              indexes.stroke,
              "paint",
              "line-opacity",
              Math.min(value * 2, 1)
            );
          }
        }}
      />
      <StrokeStyleEditor
        strokeLayer={
          indexes.stroke !== -1 ? context.glLayers[indexes.stroke] : undefined
        }
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
