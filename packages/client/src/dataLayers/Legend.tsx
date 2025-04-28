import {
  DynamicRenderingSupportOptions,
  LegendItem as LegendSymbolItem,
} from "@seasketch/mapbox-gl-esri-sources";
import { GLLegendPanel, LegendForGLLayers } from "./legends/LegendDataModel";
import * as Accordion from "@radix-ui/react-accordion";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretDownIcon,
  DotsHorizontalIcon,
  EyeClosedIcon,
  EyeOpenIcon,
  HeightIcon,
} from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
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
import { useContext, useState } from "react";
import {
  TableOfContentsItemMenu,
  TocMenuItemType,
} from "../admin/data/TableOfContentsItemMenu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LayerEditingContext } from "../admin/data/LayerEditingContext";
import clsx from "clsx";
import {
  MenuBarContentClasses,
  MenuBarItemClasses,
} from "../components/Menubar";
import {
  SketchClassItemMenu,
  SketchClassMenuItemType,
} from "./SketchClassItemMenu";

require("../admin/data/arcgis/Accordion.css");

interface CustomGLSourceSymbolLegend {
  label: string;
  type: "CustomGLSourceSymbolLegend";
  supportsDynamicRendering: DynamicRenderingSupportOptions;
  symbols: LegendSymbolItem[];
  id: string;
}

interface GLStyleLegendItem {
  label: string;
  type: "GLStyleLegendItem";
  /** Table of contents item id */
  id: string;
  legend?: LegendForGLLayers;
}

export type LegendItem = (GLStyleLegendItem | CustomGLSourceSymbolLegend) & {
  tableOfContentsItemDetails?: TocMenuItemType;
  isSketchClass?: boolean;
};

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
  editable,
}: {
  backdropBlur?: boolean;
  items: LegendItem[];
  zOrder: { [id: string]: number };
  opacity: { [id: string]: number };
  hiddenItems: string[];
  onHiddenItemsChange?: (id: string, hidden: boolean) => void;
  className?: string;
  loading?: boolean;
  map?: Map;
  maxHeight?: number;
  persistedStateKey?: string;
  editable?: boolean;
}) {
  const { t } = useTranslation("homepage");
  maxHeight = maxHeight || undefined;
  const [hidden, setHidden] = useLocalForage<boolean>(
    persistedStateKey || "legend",
    true
  );
  const layerEditingContext = useContext(LayerEditingContext);
  return (
    <div
      style={
        blur
          ? {
              backdropFilter: "blur(10px)",
            }
          : {}
      }
      className={`${className || ""} shadow rounded bg-white bg-opacity-90 ${
        hidden ? "w-auto" : "w-64"
      } text-sm flex flex-col overflow-hidden`}
    >
      <Accordion.Root type="single" value={hidden ? "" : "legend"}>
        <Accordion.Item value="legend">
          <Accordion.Header
            onClick={(e) => {
              setHidden((prev) => !prev);
            }}
            className="flex-none flex p-2 py-1.5 shadow"
          >
            <Accordion.Trigger className="flex w-full AccordionTrigger">
              <span className="flex-1 text-left flex items-center">
                <span>{t("Legend")}</span>
                {loading && !hidden && (
                  <Spinner className="scale-75 transform ml-1" />
                )}
              </span>
              <CaretDownIcon
                className="w-5 h-5 AccordionChevron text-gray-500"
                aria-hidden
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="flex-1 max-h-full overflow-y-auto border-t border-black border-opacity-10">
            <ul
              className="list-none overflow-y-auto pr-1"
              style={{ maxHeight }}
            >
              {items.map((item, i) => {
                if (
                  layerEditingContext?.recentlyDeletedStableIds?.includes(
                    item.id
                  )
                ) {
                  return null;
                }
                return (
                  <LegendListItem
                    editable={editable}
                    onHiddenItemsChange={onHiddenItemsChange}
                    key={item.id}
                    item={item}
                    visible={!hiddenItems || !hiddenItems.includes(item.id)}
                    map={map}
                    skipTopBorder={i === 0}
                    top={i === 0}
                    bottom={i === items.length - 1}
                  />
                );
              })}
            </ul>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  );
}

function LegendListItem({
  item,
  visible,
  map,
  onHiddenItemsChange,
  skipTopBorder,
  editable,
  top,
  bottom,
}: {
  item: LegendItem;
  visible: boolean;
  map?: Map;
  onHiddenItemsChange?: (id: string, hidden: boolean) => void;
  skipTopBorder?: boolean;
  editable?: boolean;
  top?: boolean;
  bottom?: boolean;
}) {
  const [contextMenuIsOpen, setContextMenuIsOpen] = useState(false);
  const isSingleSymbol =
    (item.type === "GLStyleLegendItem" &&
      item.legend?.type === "SimpleGLLegend" &&
      item.legend.symbol) ||
    (item.type === "CustomGLSourceSymbolLegend" && item.symbols.length <= 1);
  return (
    <ErrorBoundary>
      <li
        className={`group ${
          skipTopBorder ? "" : "border-t border-black border-opacity-5"
        } p-2 max-w-full ${!visible ? "opacity-50" : "opacity-100"}`}
      >
        <div className="flex items-center space-x-2">
          {/* If single-symbol, show inline image */}
          {isSingleSymbol && (
            <div className="items-center justify-center bg-transparent flex-none">
              {item.type === "GLStyleLegendItem" &&
                map &&
                item.legend?.type === "SimpleGLLegend" && (
                  <SimpleSymbol map={map} data={item.legend.symbol} />
                )}
              {item.type === "CustomGLSourceSymbolLegend" &&
                item.symbols.length === 1 && (
                  <LegendImage item={item.symbols[0]} />
                )}
            </div>
          )}
          {/* Title */}
          <span title={item.label} className="truncate flex-1">
            {item.label}
          </span>
          {/* Buttons */}
          <div
            className={`${
              contextMenuIsOpen
                ? "opacity-50"
                : "opacity-10 group-hover:opacity-50 focus:opacity-100 focus-visible:opacity-100"
            } flex-none group pl-1 flex items-center space-x-1 `}
          >
            {item.tableOfContentsItemDetails && (
              <DropdownMenu.Root
                onOpenChange={(open) => setContextMenuIsOpen(open)}
              >
                <DropdownMenu.Portal>
                  <TableOfContentsItemMenu
                    items={[item.tableOfContentsItemDetails]}
                    type={DropdownMenu}
                    editable={editable}
                    top={top}
                    bottom={bottom}
                  />
                </DropdownMenu.Portal>
                <DropdownMenu.Trigger asChild>
                  <button
                    aria-label="Open context menu"
                    className={clsx(
                      contextMenuIsOpen
                        ? "opacity-100"
                        : "opacity-80 group-hover:opacity-100 focus:opacity-100"
                    )}
                  >
                    <DotsHorizontalIcon
                      className={`w-5 h-5 text-black  cursor-pointer ${
                        contextMenuIsOpen
                          ? "inline-block bg-gray-200 border border-black border-opacity-20 rounded-full"
                          : "inline-block"
                      } `}
                    />
                  </button>
                </DropdownMenu.Trigger>
              </DropdownMenu.Root>
            )}
            {item.isSketchClass && (
              <DropdownMenu.Root
                onOpenChange={(open) => setContextMenuIsOpen(open)}
              >
                <DropdownMenu.Portal>
                  <SketchClassItemMenu
                    item={item}
                    sketchClassId={parseInt(item.id.split("sketch-class-")[1])}
                    type={DropdownMenu}
                    top={top}
                    bottom={bottom}
                  />
                </DropdownMenu.Portal>
                <DropdownMenu.Trigger asChild>
                  <button
                    aria-label="Open context menu"
                    className={clsx(
                      contextMenuIsOpen
                        ? "opacity-100"
                        : "opacity-80 group-hover:opacity-100 focus:opacity-100"
                    )}
                  >
                    <DotsHorizontalIcon
                      className={`w-5 h-5 text-black  cursor-pointer ${
                        contextMenuIsOpen
                          ? "inline-block bg-gray-200 border border-black border-opacity-20 rounded-full"
                          : "inline-block"
                      } `}
                    />
                  </button>
                </DropdownMenu.Trigger>
              </DropdownMenu.Root>
            )}
            <Toggle
              className={`inline-block`}
              onChange={() => {
                if (onHiddenItemsChange) {
                  onHiddenItemsChange(item.id, visible);
                }
              }}
              visible={visible}
            />
          </div>
        </div>
        {!isSingleSymbol && (
          <ul className="text-sm p-1">
            {item.type === "GLStyleLegendItem" &&
              item.legend?.type === "MultipleSymbolGLLegend" &&
              item.legend.panels.map((panel) => (
                <PanelFactory key={panel.id} map={map} panel={panel} />
              ))}
            {item.type === "CustomGLSourceSymbolLegend" &&
              item.symbols.length > 1 &&
              item.symbols.map((symbol) => {
                return (
                  <li className="flex items-center space-x-2" key={symbol.id}>
                    <LegendImage item={symbol} />
                    <span className="truncate">{symbol.label}</span>
                  </li>
                );
              })}
          </ul>
        )}
      </li>
    </ErrorBoundary>
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
                <h3 className="text-xs mt-2 font-mono">{panel.label}</h3>
                <ul className="p-1">
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
      aria-label="Hide layer"
      onClick={onChange}
      className={`${className} text-black`}
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
