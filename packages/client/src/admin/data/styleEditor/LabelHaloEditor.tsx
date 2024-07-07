import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { SymbolLayer, SymbolPaint } from "mapbox-gl";
import { isExpression } from "../../../dataLayers/legends/utils";
import { isSymbolLayer } from "./LabelLayerEditor";
import Switch from "../../../components/Switch";

export default function LabelHaloEditor() {
  const { t, glLayers, updateLayer } = useContext(Editor.GUIEditorContext);
  const layer = useMemo(() => {
    return glLayers.find(
      (l) => isSymbolLayer(l) && l.layout?.["text-field"] !== undefined
    ) as SymbolLayer;
  }, [glLayers]);
  if (!layer) {
    return null;
  }

  const paint = layer.paint as SymbolPaint;
  const width = paint?.["text-halo-width"];
  const color = paint?.["text-halo-color"];
  return (
    <Editor.Root>
      <Editor.Label title={t("Halo")} />
      <Editor.Control>
        {(width !== undefined && isExpression(width)) ||
        (color !== undefined && isExpression(color)) ? (
          <Editor.CustomExpressionIndicator
            onClear={() => {
              updateLayer(
                glLayers.indexOf(layer),
                "paint",
                "text-halo-width",
                1.3
              );
              updateLayer(
                glLayers.indexOf(layer),
                "paint",
                "text-halo-color",
                "rgba(255,255,255,0.9)"
              );
            }}
          />
        ) : (
          <Switch
            isToggled={typeof width === "number" && (width as number) > 0}
            onClick={(val) => {
              const layerIndex = glLayers.indexOf(layer);
              if (layerIndex > -1) {
                updateLayer(
                  layerIndex,
                  "paint",
                  "text-halo-width",
                  val ? 1.3 : 0
                );
                updateLayer(
                  layerIndex,
                  "paint",
                  "text-halo-color",
                  "rgba(255,255,255,0.9)"
                );
              }
            }}
          />
        )}
      </Editor.Control>
    </Editor.Root>
  );
}
