import {
  DynamicRenderingSupportOptions,
  LegendItem as LegendSymbolItem,
} from "@seasketch/mapbox-gl-esri-sources";
import { GLLegendPanel, LegendForGLLayers } from "./legends/LegendDataModel";
import * as Accordion from "@radix-ui/react-accordion";
import {
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
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MenuBarSeparator } from "../components/Menubar";
import { useContext, useState } from "react";
import { MapContext } from "./MapContextManager";

require("../admin/data/arcgis/Accordion.css");

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

export type LegendItem = GLStyleLegendItem | CustomGLSourceSymbolLegend;

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
  onZOrderChange,
}: {
  backdropBlur?: boolean;
  items: LegendItem[];
  zOrder: { [id: string]: number };
  opacity: { [id: string]: number };
  hiddenItems: string[];
  onZOrderChange?: (id: string, zOrder: number) => void;
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
              className="list-none overflow-y-auto pr-1"
              style={{ maxHeight }}
            >
              {items.map((item, i) => {
                return (
                  <LegendListItem
                    onHiddenItemsChange={onHiddenItemsChange}
                    key={item.id}
                    item={item}
                    visible={!hiddenItems || !hiddenItems.includes(item.id)}
                    map={map}
                    skipTopBorder={i === 0}
                    onZOrderChange={onZOrderChange}
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
  onZOrderChange,
}: {
  item: LegendItem;
  visible: boolean;
  map?: Map;
  onHiddenItemsChange?: (id: string, hidden: boolean) => void;
  skipTopBorder?: boolean;
  onZOrderChange?: (id: string, zOrder: number) => void;
}) {
  const [contextMenuIsOpen, setContextMenuIsOpen] = useState(false);
  const mapContext = useContext(MapContext);
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
        <DropdownMenu.Root onOpenChange={(open) => setContextMenuIsOpen(open)}>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              style={{ backdropFilter: "blur(3px)", minWidth: 220 }}
              className="z-50 bg-gray-100 bg-opacity-90 rounded shadow-md p-1.5 border border-black border-opacity-10"
              align="start"
              sideOffset={5}
            >
              <DropdownMenu.Item
                className="RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none outline-none"
                onSelect={() => {
                  mapContext?.manager?.zoomToTocItem(item.id);
                }}
              >
                <Trans>Zoom to</Trans>
              </DropdownMenu.Item>
              {/* <MenuBarSeparator /> */}
              <DropdownMenu.Item className="RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none outline-none ">
                <Trans>Metadata</Trans>
              </DropdownMenu.Item>
              {/* <DropdownMenu.Arrow style={{ fill: "white" }} /> */}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
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
                  : "opacity-10 group-hover:opacity-50"
              } flex-none group pl-1 flex items-center space-x-1 `}
            >
              <HeightIcon
                className={`w-4 h-4 text-black ${
                  contextMenuIsOpen
                    ? "inline-block"
                    : "hidden group-hover:inline-block"
                }`}
                style={{ cursor: "ns-resize" }}
              />
              <DropdownMenu.Trigger asChild>
                <DotsHorizontalIcon
                  className={`w-5 h-5 text-black  cursor-pointer ${
                    contextMenuIsOpen
                      ? "inline-block bg-gray-200 border border-black border-opacity-20 rounded-full"
                      : "hidden group-hover:inline-block"
                  } `}
                />
              </DropdownMenu.Trigger>
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
        </DropdownMenu.Root>
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
    <button onClick={onChange} className={`${className} text-black`}>
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
