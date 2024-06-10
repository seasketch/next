import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { ChangeEventHandler, RefObject, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatJSONCommand } from "./GLStyleEditor/formatCommand";

export default function GUIStyleEditor({
  editorRef,
  style,
}: {
  editorRef: RefObject<ReactCodeMirrorRef>;
  style: string;
}) {
  const { t } = useTranslation("admin:data");

  const rasterResampling = useMemo(() => {
    try {
      const parsed = JSON.parse(style);
      if (Array.isArray(parsed) && parsed.length === 1) {
        const layer = parsed[0];
        if ("paint" in layer) {
          if ("raster-resampling" in layer.paint) {
            return layer.paint["raster-resampling"];
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [style]);

  const onRasterResamplingChanged = useCallback(
    ((e) => {
      const value = e.target.value;
      if (value !== "linear" && value !== "nearest") {
        throw new Error("Invalid raster resampling value");
      }
      const parsed = JSON.parse(style);
      if (Array.isArray(parsed) && parsed.length === 1) {
        const layer = parsed[0];
        if ("paint" in layer) {
          layer.paint["raster-resampling"] = value;
        }
      }
      editorRef.current?.view?.dispatch({
        changes: {
          from: 0,
          to: editorRef.current.view!.state.doc.length,
          insert: JSON.stringify(parsed),
        },
      });
      formatJSONCommand(editorRef.current?.view!);
    }) as ChangeEventHandler<HTMLSelectElement>,
    [editorRef]
  );

  return (
    <div>
      <select value={rasterResampling} onChange={onRasterResamplingChanged}>
        <option value="linear">{t("linear")}</option>
        <option value="nearest">{t("nearest")}</option>
      </select>
    </div>
  );
}
