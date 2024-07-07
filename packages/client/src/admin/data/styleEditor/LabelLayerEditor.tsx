import { useContext, useMemo } from "react";
import * as Editor from "./Editors";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import { SymbolLayer } from "mapbox-gl";
import { isRasterInfo } from "@seasketch/geostats-types";
import { ZoomRangeEditor } from "./ZoomRangeEditor";
import { isExpression } from "../../../dataLayers/legends/utils";
import { ChevronDownIcon, TrashIcon } from "@radix-ui/react-icons";
import FontSizeEditor from "./FontSizeEditor";
import LabelColorEditor from "./LabelColorEditor";

export default function LabelLayerEditor() {
  const Select = Editor.Select;
  const Tooltip = Editor.Tooltip;

  const { t, glLayers, geostats, addLayer, updateLayer, removeLayer } =
    useContext(Editor.GUIEditorContext);
  const labels = useMemo(() => {
    const layer = glLayers.find(
      (l) => isSymbolLayer(l) && l.layout?.["text-field"]
    );
    if (layer) {
      return {
        layer: layer as SymbolLayer,
        index: glLayers.indexOf(layer),
      };
    } else {
      return {};
    }
  }, [glLayers]);

  const labelFields = useMemo(() => {
    if (isRasterInfo(geostats)) {
      return [];
    } else {
      return geostats.attributes.filter((f) => f.type === "string");
    }
  }, [geostats]);

  if (isRasterInfo(geostats)) {
    return null;
  }

  if (labelFields.length === 0 && !labels.layer) {
    return null;
  }

  if (!labels.layer) {
    return (
      <Editor.Root>
        <Editor.Label className="opacity-50" title={t("Labels")} />
        <Editor.Control>
          <div className="flex items-center space-x-2">
            <button
              className="opacity-80 text-indigo-200 hover:opacity-100"
              onClick={() => {
                let bestLabel = labelFields[0].attribute;
                for (let i = 1; i < labelFields.length; i++) {
                  const attr = labelFields[i].attribute;
                  if (
                    /name/i.test(attr) ||
                    /label/i.test(attr) ||
                    /title/i.test(attr)
                  ) {
                    bestLabel = attr;
                  }
                }
                const layer: Omit<SymbolLayer, "id"> = {
                  type: "symbol",
                  layout: {
                    "text-field": `{${bestLabel}}`,
                    "text-size": 12,
                    "text-anchor": "center",
                    "text-offset": [0, 0],
                  },
                  paint: {
                    "text-color": "#000000",
                    "text-halo-color": "#ffffff",
                    "text-halo-width": 1,
                  },
                  minzoom: 5,
                };
                addLayer(glLayers.length, layer);
              }}
            >
              {t("Add Labels")}
            </button>
          </div>
        </Editor.Control>
      </Editor.Root>
    );
  } else {
    return (
      <>
        <br />
        <Editor.CardTitle
          buttons={
            <>
              <Tooltip.Provider>
                <Tooltip.Root delayDuration={100}>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => {
                        removeLayer(labels.index);
                      }}
                      className=" text-indigo-200 opacity-20 hover:opacity-100 text-sm flex items-center space-x-1"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content side="top">
                      <div className="px-2 text-sm">
                        <p>Remove labels</p>
                      </div>
                      <Tooltip.Arrow />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </>
          }
        >
          <span>{t("Labels")}</span>
        </Editor.CardTitle>
        <Editor.Root>
          <Editor.Label title={t("Label Field")} />
          <Editor.Control>
            {isExpression(labels.layer.layout?.["text-field"]) ? (
              <Editor.CustomExpressionIndicator />
            ) : (
              <Select.Root
                value={labels.layer.layout?.["text-field"] as string}
                onValueChange={(v) => {
                  updateLayer(labels.index, "layout", "text-field", v);
                }}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select Field" />
                  <Select.Icon>
                    <ChevronDownIcon />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content>
                    <Select.Viewport>
                      {labelFields.map((field) => (
                        <Select.Item
                          key={field.attribute}
                          value={`{${field.attribute}}`}
                        >
                          <Select.ItemText>{field.attribute}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            )}
          </Editor.Control>
        </Editor.Root>
        <ZoomRangeEditor
          disableRemove
          minzoom={labels.layer.minzoom || 0}
          maxzoom={labels.layer.maxzoom || 24}
          onChange={(minzoom, maxzoom) => {
            updateLayer(labels.index, undefined, "minzoom", minzoom);
            updateLayer(labels.index, undefined, "maxzoom", maxzoom);
          }}
        />
        <FontSizeEditor />
        <LabelColorEditor />
      </>
    );
  }
}

export function isSymbolLayer(layer: SeaSketchGlLayer): layer is SymbolLayer {
  return layer.type === "symbol";
}
