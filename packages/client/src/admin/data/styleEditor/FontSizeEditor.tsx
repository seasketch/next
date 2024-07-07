import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { FontSizeIcon } from "@radix-ui/react-icons";
import { SymbolLayer } from "mapbox-gl";
import { isExpression } from "../../../dataLayers/legends/utils";
import { isSymbolLayer } from "./LabelLayerEditor";

export default function FontSizeEditor() {
  const { t, glLayers, updateLayer } = useContext(Editor.GUIEditorContext);
  const layer = useMemo(() => {
    return glLayers.find(
      (l) => isSymbolLayer(l) && l.layout?.["text-field"] !== undefined
    ) as SymbolLayer;
  }, [glLayers]);
  if (!layer) {
    return null;
  }
  return (
    <Editor.Root>
      <Editor.Label title={t("Font Size")} />
      <Editor.Control>
        {layer.layout?.["text-size"] !== undefined &&
        isExpression(layer.layout?.["text-size"]) ? (
          <Editor.CustomExpressionIndicator
            onClear={() => {
              updateLayer(glLayers.indexOf(layer), "layout", "text-size", 16);
            }}
          />
        ) : (
          <>
            <FontSizeIcon className="w-4 h-4" />
            <Editor.NumberSliderAndInput
              min={6}
              max={32}
              step={1}
              onChange={(size) => {
                updateLayer(
                  glLayers.indexOf(layer),
                  "layout",
                  "text-size",
                  size
                );
              }}
              value={(layer.layout?.["text-size"] as number) || 16}
            />
          </>
        )}
      </Editor.Control>
    </Editor.Root>
  );
}
