import {
  DynamicRenderingSupportOptions,
  LegendItem as LegendSymbolItem,
} from "@seasketch/mapbox-gl-esri-sources";
import { GLLegendPanel, LegendForGLLayers } from "./legends/LegendDataModel";
import * as Accordion from "@radix-ui/react-accordion";
import {
  CaretDownIcon,
  EyeClosedIcon,
  EyeOpenIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import Spinner from "../components/Spinner";
import SimpleSymbol from "./legends/SimpleSymbol";
import { Map } from "mapbox-gl";
import LegendBubblePanel from "./legends/LegendBubblePanel";
import LegendGradientPanel from "./legends/LegendGradientPanel";
import LegendHeatmapPanel from "./legends/LegendHeatmapPanel";
import LegendListPanel from "./legends/LegendListPanel";
import LegendMarkerSizePanel from "./legends/LegendMarkerSizePanel";
import LegendStepPanel from "./legends/LegendStepPanel";
import LegendSimpleSymbolPanel from "./legends/LegendSimpleSymbolPanel";
require("../admin/data/arcgis/Accordion.css");

interface SingleImageLegendItem {
  type: "SingleImageLegendItem";
  label: string;
  /** TableOfContentsItem ids */
  ids: string[];
  /** Image URL */
  url: string;
  supportsDynamicRendering: DynamicRenderingSupportOptions;
}

interface CustomGLSourceSymbolLegend {
  label: string;
  type: "CustomGLSourceSymbolLegend";
  supportsDynamicRendering: DynamicRenderingSupportOptions;
  symbols: LegendSymbolItem[];
}

interface GLStyleLegendItem {
  label: string;
  type: "GLStyleLegendItem";
  /** Table of contents item id */
  id: string;
  legend?: LegendForGLLayers;
}

export type LegendItem =
  | GLStyleLegendItem
  | CustomGLSourceSymbolLegend
  | SingleImageLegendItem;

const PANEL_WIDTH = 180;

export default function Legend({
  className,
  items,
  loading,
  hiddenItems,
  onHiddenItemsChange,
  map,
  maxHeight,
}: {
  items: LegendItem[];
  zOrder: { [id: string]: number };
  opacity: { [id: string]: number };
  hiddenItems: string[];
  onZOrderChange?: (id: string, zOrder: number) => void;
  onOpacityChange?: (id: string, opacity: number) => void;
  onHiddenItemsChange?: (id: string, hidden: boolean) => void;
  className?: string;
  loading?: boolean;
  map?: Map;
  maxHeight?: number;
}) {
  const { t } = useTranslation("homepage");
  maxHeight = maxHeight || undefined;
  return (
    <div
      style={
        {
          // backdropFilter: "blur(10px)",
        }
      }
      className={`${className} shadow rounded bg-white bg-opacity-95 w-64 text-sm flex flex-col overflow-hidden`}
    >
      <Accordion.Root type="single" collapsible defaultValue="legend">
        <Accordion.Item value="legend">
          <Accordion.Header className="flex-none flex p-2">
            <Accordion.Trigger className="flex w-full AccordionTrigger">
              <h3 className="flex-1 text-left flex items-center">
                <span>{t("Legend")}</span>
                {loading && <Spinner className="scale-75 transform ml-1" />}
              </h3>
              <CaretDownIcon
                className="w-5 h-5 AccordionChevron text-gray-500"
                aria-hidden
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="flex-1 max-h-full overflow-y-auto border-t border-gray-200">
            <ul
              className="list-none space-y-1 overflow-y-auto p-2 pr-2.5"
              style={{ maxHeight }}
            >
              {items.map((item, i) => {
                if (item.type === "GLStyleLegendItem") {
                  const legend = item.legend;
                  if (!legend || legend.type === "SimpleGLLegend") {
                    const visible =
                      !hiddenItems || !hiddenItems.includes(item.id);
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center space-x-2 max-w-full ${
                          hiddenItems && hiddenItems.includes(item.id)
                            ? "opacity-50"
                            : "opacity-100"
                        }`}
                      >
                        <div className="items-center justify-center bg-transparent">
                          {map && legend ? (
                            <SimpleSymbol map={map} data={legend.symbol} />
                          ) : null}
                        </div>

                        <span className="truncate flex-1">{item.label}</span>
                        <Toggle
                          onChange={() => {
                            if (onHiddenItemsChange) {
                              onHiddenItemsChange(
                                item.id,
                                !hiddenItems.includes(item.id)
                              );
                            }
                          }}
                          visible={visible}
                        />
                      </li>
                    );
                  } else if (legend.type === "MultipleSymbolGLLegend") {
                    const visible =
                      !hiddenItems || !hiddenItems.includes(item.id);
                    return (
                      <li
                        key={item.id}
                        className={`max-w-full ${
                          visible ? "opacity-100" : "opacity-50"
                        }`}
                      >
                        <div className="flex items-center space-x-1 mb-0.5">
                          <span className="truncate flex-1">{item.label}</span>
                          <Toggle
                            onChange={() => {
                              if (onHiddenItemsChange) {
                                onHiddenItemsChange(item.id, !visible);
                              }
                            }}
                            visible={visible}
                          />
                        </div>
                        <ul className="text-sm mb-1">
                          {legend.panels.map((panel) => (
                            <PanelFactory
                              key={panel.id}
                              map={map}
                              panel={panel}
                            />
                          ))}
                        </ul>
                      </li>
                    );
                  } else {
                    return null;
                  }
                } else {
                  return null;
                }
              })}
            </ul>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  );
}

function PanelFactory({ panel, map }: { panel: GLLegendPanel; map?: Map }) {
  return (
    <div>
      {(() => {
        switch (panel.type) {
          case "GLLegendHeatmapPanel":
            return <LegendHeatmapPanel panel={panel} />;
          case "GLLegendGradientPanel":
            return <LegendGradientPanel panel={panel} />;
          case "GLLegendBubblePanel":
            return <LegendBubblePanel panelWidth={PANEL_WIDTH} panel={panel} />;
          case "GLLegendListPanel":
            return <LegendListPanel map={map} panel={panel} />;
          case "GLMarkerSizePanel":
            return <LegendMarkerSizePanel map={map} panel={panel} />;
          case "GLLegendStepPanel":
            return <LegendStepPanel panel={panel} map={map} />;
          case "GLLegendSimpleSymbolPanel":
            return <LegendSimpleSymbolPanel map={map} panel={panel} />;
          case "GLLegendFilterPanel":
            return (
              <div key={panel.id} className="">
                <h3 className="text-xs pl-2 mt-2 font-mono">{panel.label}</h3>
                <ul className="">
                  {panel.children.map((child) => (
                    <PanelFactory key={child.id} panel={child} map={map} />
                  ))}
                </ul>
              </div>
            );
          default:
            // eslint-disable-next-line i18next/no-literal-string
            return <div>not implemented</div>;
        }
      })()}
    </div>
  );
}

function Toggle({
  visible,
  onChange,
  className,
}: {
  visible: boolean;
  onChange?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onChange}
      className={`${className} text-gray-500 hover:text-black`}
    >
      {visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
    </button>
  );
}
