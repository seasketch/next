import { Trans, useTranslation } from "react-i18next";
import * as Editor from "./Editors";
import * as Select from "@radix-ui/react-select";
import { useContext, useMemo } from "react";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import { isLineLayer } from "./SimplePolygonEditor";
import { LinePaint } from "mapbox-gl";
import { ChevronDownIcon } from "@radix-ui/react-icons";

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
        return strokeLayer.paint["line-dasharray"].join(",");
      } else {
        return "Solid";
      }
    } else {
      return "None";
    }
  }, [strokeLayer && (strokeLayer?.paint as LinePaint)?.["line-dasharray"]]);

  const isCustomDashArray =
    /,/.test(value) && value !== "4,4" && value !== "4,2" && value !== "0,2";

  console.log("value", value);
  return (
    <Editor.Root>
      <Editor.Label title={t("Stroke Style")} />
      <Editor.Control>
        <Select.Root value={value}>
          <Select.Trigger
            className="inline-flex items-center justify-center rounded px-2.5 text-sm leading-none h-8 gap-1 bg-gray-700 text-gray-400 shadow  outline-none focus:ring-2 focus:border-transparent ring-blue-600 border border-gray-500"
            aria-label="Stroke Style"
          >
            <Select.Value placeholder="None" />
            <Select.Icon className="text-gray-500">
              <ChevronDownIcon className="w-4 h-4" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              className=" overflow-hidden bg-white  rounded-md shadow z-50 w-52"
              sideOffset={5}
            >
              <Select.ScrollUpButton />
              <Select.Viewport className="p-2 LayerEditorPalette">
                <Select.Item
                  value="None"
                  className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
                >
                  <Select.ItemText>
                    <div className="flex">
                      <Trans ns="admin:data">None</Trans>
                    </div>
                  </Select.ItemText>
                </Select.Item>
                <Select.Item
                  value="Outline"
                  className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
                >
                  <Select.ItemText>
                    <div className="flex">
                      <Trans ns="admin:data">Thin Outline</Trans>
                    </div>
                  </Select.ItemText>
                </Select.Item>
                {isCustomDashArray && (
                  <Select.Item
                    value={value}
                    className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
                  >
                    <Select.ItemText>
                      <div className="flex">
                        <Trans ns="admin:data">Custom Dash Array</Trans>
                      </div>
                    </Select.ItemText>
                  </Select.Item>
                )}
                <Select.Item
                  value="Solid"
                  className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
                >
                  <Select.ItemText>
                    <div className="flex">
                      <svg width="100%" height="60">
                        <line
                          strokeWidth={2}
                          x1="0"
                          y1="30"
                          x2="100%"
                          y2="30"
                          stroke="#888"
                        />
                      </svg>
                    </div>
                  </Select.ItemText>
                </Select.Item>
                <Select.Item
                  value="4,4"
                  className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
                >
                  <Select.ItemText>
                    <div className="flex">
                      <svg width="100%" height="60">
                        <line
                          strokeWidth={2}
                          strokeDasharray={"6,6"}
                          x1="0"
                          y1="30"
                          x2="100%"
                          y2="30"
                          stroke="#888"
                        />
                      </svg>
                    </div>
                  </Select.ItemText>
                </Select.Item>
                <Select.Item
                  value="4,2"
                  className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
                >
                  <Select.ItemText>
                    <div className="flex">
                      <svg width="100%" height="60">
                        <line
                          strokeWidth={2}
                          strokeDasharray={"6,2"}
                          x1="0"
                          y1="30"
                          x2="100%"
                          y2="30"
                          stroke="#888"
                        />
                      </svg>
                    </div>
                  </Select.ItemText>
                </Select.Item>
                <Select.Item
                  value="0,2"
                  className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
                >
                  <Select.ItemText>
                    <div className="flex">
                      <svg width="100%" height="60">
                        <line
                          strokeWidth={2}
                          strokeDasharray={"2,2"}
                          x1="0"
                          y1="30"
                          x2="100%"
                          y2="30"
                          stroke="#888"
                        />
                      </svg>
                    </div>
                  </Select.ItemText>
                </Select.Item>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </Editor.Control>
    </Editor.Root>
  );
}
