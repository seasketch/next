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
import { useLocalForage } from "../useLocalForage";
import { ErrorBoundary } from "@sentry/react";
require("../admin/data/arcgis/Accordion.css");

interface SingleImageLegendItem {
  type: "SingleImageLegendItem";
  label: string;
  /** TableOfContentsItem ids */
  ids: string[];
  /** Image URL */
  url: string;
  supportsDynamicRendering: DynamicRenderingSupportOptions;
  id: string;
  zOrder?: number;
}

interface CustomGLSourceSymbolLegend {
  label: string;
  type: "CustomGLSourceSymbolLegend";
  supportsDynamicRendering: DynamicRenderingSupportOptions;
  symbols: LegendSymbolItem[];
  id: string;
  zOrder?: number;
}

interface GLStyleLegendItem {
  label: string;
  type: "GLStyleLegendItem";
  /** Table of contents item id */
  id: string;
  legend?: LegendForGLLayers;
  zOrder?: number;
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
  backdropBlur: blur,
  persistedStateKey,
}: {
  backdropBlur?: boolean;
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
  persistedStateKey?: string;
}) {
  const { t } = useTranslation("homepage");
  maxHeight = maxHeight || undefined;
  const [hidden, setHidden] = useLocalForage<boolean>(
    persistedStateKey || "legend",
    true
  );

  return (
    <div
      style={
        blur
          ? {
            backdropFilter: "blur(10px)",
          }
          : {}
      }
      className={`${className || ""} shadow rounded bg-white bg-opacity-90 ${hidden ? "w-auto" : "w-64"
        } text-sm flex flex-col overflow-hidden`}
    >
      <Accordion.Root type="single" value={hidden ? "" : "legend"}>
        <Accordion.Item value="legend">
          <Accordion.Header
            onClick={(e) => {
              setHidden((prev) => !prev);
            }}
            className="flex-none flex p-2 py-1.5"
          >
            <Accordion.Trigger className="flex w-full AccordionTrigger">
              <h3 className="flex-1 text-left flex items-center">
                <span>{t("Legend")}</span>
                {loading && !hidden && (
                  <Spinner className="scale-75 transform ml-1" />
                )}
              </h3>
              <CaretDownIcon
                className="w-5 h-5 AccordionChevron text-gray-500"
                aria-hidden
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="flex-1 max-h-full overflow-y-auto border-t border-black border-opacity-10">
            <ul
              className="list-none space-y-1 overflow-y-auto p-2 pr-2.5"
              style={{ maxHeight }}
            >
              {items.map((item, i) => {
                const visible = !hiddenItems || !hiddenItems.includes(item.id);
                if (item.type === "GLStyleLegendItem") {
                  const legend = item.legend;
                  if (!legend || legend.type === "SimpleGLLegend") {
                    const visible =
                      !hiddenItems || !hiddenItems.includes(item.id);
                    return (
                      <ErrorBoundary key={item.id}>
                        <li
                          className={`flex items-center space-x-2 max-w-full ${hiddenItems && hiddenItems.includes(item.id)
                              ? "opacity-50"
                              : "opacity-100"
                            }`}
                        >
                          <div className="items-center justify-center bg-transparent">
                            {map && legend ? (
                              <SimpleSymbol map={map} data={legend.symbol} />
                            ) : null}
                          </div>

                          <span title={item.label} className="truncate flex-1">
                            {item.label}
                          </span>
                          {onHiddenItemsChange && (
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
                          )}
                        </li>
                      </ErrorBoundary>
                    );
                  } else if (legend.type === "MultipleSymbolGLLegend") {
                    return (
                      <ErrorBoundary key={item.id}>
                        <li
                          className={`max-w-full ${visible ? "opacity-100" : "opacity-50"
                            }`}
                        >
                          <div className="flex items-center space-x-1 mb-0.5">
                            <span
                              title={item.label}
                              className="truncate flex-1"
                            >
                              {item.label}
                            </span>
                            {onHiddenItemsChange && (
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
                            )}
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
                      </ErrorBoundary>
                    );
                  } else {
                    return null;
                  }
                } else if (item.type === "CustomGLSourceSymbolLegend") {
                  if (item.symbols.length <= 1) {
                    return (
                      <ErrorBoundary key={item.id}>
                        <li
                          className={`flex items-center space-x-2 max-w-full ${hiddenItems && hiddenItems.includes(item.id)
                              ? "opacity-50"
                              : "opacity-100"
                            }`}
                        >
                          {item.symbols.length > 0 && (
                            <div className="items-center justify-center bg-transparent">
                              <LegendImage item={item.symbols[0]} />
                            </div>
                          )}

                          <span title={item.label} className="truncate flex-1">
                            {item.label}
                          </span>
                          {onHiddenItemsChange && (
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
                          )}
                        </li>
                      </ErrorBoundary>
                    );
                  } else {
                    return (
                      <ErrorBoundary key={item.id}>
                        <li
                          className={`max-w-full ${visible ? "opacity-100" : "opacity-50"
                            }`}
                        >
                          <div className="flex items-center space-x-1 mb-0.5">
                            <span
                              title={item.label}
                              className="truncate flex-1"
                            >
                              {item.label}
                            </span>
                            {onHiddenItemsChange && (
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
                            )}
                          </div>
                          <ul className="text-sm mb-1">
                            {item.symbols.map((symbol) => {
                              return (
                                <li
                                  className="flex items-center space-x-2"
                                  key={symbol.id}
                                >
                                  <LegendImage item={symbol} />
                                  <span className="truncate">
                                    {symbol.label}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      </ErrorBoundary>
                    );
                  }
                } else if (item.type === "SingleImageLegendItem") {
                  throw new Error("SingleImageLegendItem not implemented");
                } else {
                  console.error("unsupported type", item);
                  throw new Error("Unknown legend item type");
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

function LegendImage({
  item,
  className,
}: {
  item: LegendSymbolItem;
  className?: string;
}) {
  return (
    <img
      className={`${className}`}
      alt={item.label}
      src={item.imageUrl}
      width={
        (item.imageWidth || 20) /
        (window.devicePixelRatio > 1 ? window.devicePixelRatio / 1.5 : 1)
      }
      height={
        (item.imageHeight || 20) /
        (window.devicePixelRatio > 1 ? window.devicePixelRatio / 1.5 : 1)
      }
    />
  );
}
