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
import { Expression, FillLayer, LineLayer } from "mapbox-gl";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import AttributeSelect from "./AttributeSelect";
import {
  buildContinuousColorExpression,
  extractFirstColorFromExpression,
} from "./visualizationTypes";
import { LimitZoomTrigger, ZoomRangeEditor } from "./ZoomRangeEditor";
import { OpacityEditor } from "./OpacityEditor";
import { autoStrokeColorForFill } from "./FillStyleEditor";
import LabelLayerEditor from "./LabelLayerEditor";

export default function ContinuousPolygonEditor() {
  const { t, glLayers, geostats, updateLayer } = useContext(
    Editor.GUIEditorContext
  );
  const indexes = useMemo(() => getIndexes(glLayers), [glLayers]);
  const fillLayer = glLayers[indexes.fill] as FillLayer | undefined;
  const strokeLayer =
    indexes.stroke !== -1 ? (glLayers[indexes.stroke] as LineLayer) : undefined;
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

  return (
    <Editor.Card>
      <Editor.CardTitle
        buttons={
          <LimitZoomTrigger
            minzoom={fillLayer?.minzoom}
            maxzoom={fillLayer?.maxzoom}
            updateLayerProperty={(...args) => {
              updateLayer(indexes.fill, ...args);
            }}
          />
        }
      >
        {t("Color Range")}
      </Editor.CardTitle>
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
              }
            }}
          />
        </Editor.Control>
      </Editor.Root>
      <LabelLayerEditor />
    </Editor.Card>
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
    } else if (layer.type === "symbol") {
      indexes.labels = i;
    }
  }
  if (indexes.stroke === -1) {
    for (var i = 0; i < glLayers.length; i++) {
      const layer = glLayers[i];
      if (isLineLayer(layer)) {
        indexes.stroke = i;
        break;
      }
    }
  }
  return indexes;
}
