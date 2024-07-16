import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { Expression, SymbolLayer, SymbolPaint } from "mapbox-gl";
import { isExpression } from "../../../dataLayers/legends/utils";
import { isSymbolLayer } from "./LabelLayerEditor";
import { extractFirstColorFromExpression } from "./visualizationTypes";

export default function LabelColorEditor() {
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
  const value = paint?.["text-color"] || "#000000";
  return (
    <Editor.Root>
      <Editor.Label title={t("Color")} />
      <Editor.Control>
        {layer.paint?.["text-color"] !== undefined &&
        isExpression(layer.paint?.["text-color"]) ? (
          <Editor.CustomExpressionIndicator
            onClear={() => {
              const color =
                extractFirstColorFromExpression(value as Expression) ||
                "#000000";
              updateLayer(
                glLayers.indexOf(layer),
                "paint",
                "text-color",
                color
              );
            }}
          />
        ) : (
          <Editor.ColorPicker
            defaultColor="#000000"
            color={paint?.["text-color"] as string | undefined}
            onChange={(color) => {
              updateLayer(
                glLayers.indexOf(layer),
                "paint",
                "text-color",
                color
              );
            }}
          />
        )}
      </Editor.Control>
    </Editor.Root>
  );
}
