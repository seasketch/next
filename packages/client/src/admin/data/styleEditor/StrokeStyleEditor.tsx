import { useTranslation } from "react-i18next";
import * as Editor from "./Editors";
import { useContext, useMemo } from "react";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import { isLineLayer } from "./SimplePolygonEditor";
import { LinePaint } from "mapbox-gl";

export default function StrokeStyleEditor({
  strokeLayer,
}: {
  strokeLayer?: SeaSketchGlLayer;
}) {
  const { t } = useTranslation("admin:data");
  const context = useContext(Editor.GUIEditorContext);

  const value = useMemo(() => {
    if (strokeLayer && isLineLayer(strokeLayer)) {
      if (strokeLayer.paint?.["line-dasharray"]) {
        return strokeLayer.paint["line-dasharray"];
      } else {
        return "Solid";
      }
    } else {
      return "None";
    }
  }, [strokeLayer && (strokeLayer?.paint as LinePaint)?.["line-dasharray"]]);

  return (
    <Editor.Root>
      <Editor.Label title={t("Stroke Style")} />
      <Editor.Control>{value}</Editor.Control>
    </Editor.Root>
  );
}
