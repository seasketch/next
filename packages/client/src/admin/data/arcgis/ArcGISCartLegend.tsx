/* eslint-disable i18next/no-literal-string */
import {
  CaretDownIcon,
  EyeClosedIcon,
  EyeOpenIcon,
} from "@radix-ui/react-icons";
import {
  DataTableOfContentsItem,
  FolderTableOfContentsItem,
  ImageList,
  LegendItem,
} from "@seasketch/mapbox-gl-esri-sources";
import * as Accordion from "@radix-ui/react-accordion";
import Spinner from "../../../components/Spinner";
import { Layer, Map } from "mapbox-gl";
import {
  SeaSketchGlLayer,
  compileLegendFromGLStyleLayers2,
} from "../../../dataLayers/legends/compileLegend";
import { memo } from "react";
import SimpleSymbol from "../../../dataLayers/legends/SimpleSymbol";
import { LegendForGLLayers } from "../../../dataLayers/legends/LegendDataModel";
import {
  hasGetExpression,
  isExpression,
} from "../../../dataLayers/legends/utils";
require("./Accordion.css");

export default function ArcGISCartLegend({
  items,
  className,
  loading,
  visibleLayerIds,
  toggleLayer,
  map,
}: {
  className?: string;
  items: (FolderTableOfContentsItem | DataTableOfContentsItem)[];
  loading?: boolean;
  visibleLayerIds?: string[];
  toggleLayer?: (id: string) => void;
  map: Map;
}) {
  function onChangeVisibility(id: string) {
    if (toggleLayer) {
      return () => {
        toggleLayer(id);
      };
    } else {
      return undefined;
    }
  }
  if (items.length === 0) {
    return null;
  } else {
    return (
      <div
        style={{
          backdropFilter: "blur(10px)",
        }}
        className={`${className} shadow rounded bg-white bg-opacity-90 w-64 text-sm flex flex-col overflow-hidden`}
      >
        <Accordion.Root type="single" collapsible defaultValue="legend">
          <Accordion.Item value="legend">
            <Accordion.Header className="flex-none flex p-2">
              <Accordion.Trigger className="flex w-full AccordionTrigger">
                <h3 className="flex-1 text-left flex items-center">
                  <span>Legend</span>
                  {loading && <Spinner className="scale-75 transform ml-1" />}
                </h3>

                <CaretDownIcon
                  className="w-5 h-5 AccordionChevron text-gray-500"
                  aria-hidden
                />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="flex-1 max-h-full overflow-y-auto border-t border-gray-200">
              {/* <div className={`flex-1 max-h-full overflow-y-auto mt-2`}> */}
              <ul className="list-none space-y-1 max-h-96 overflow-y-auto p-2 pr-2.5">
                {items.map((item) => {
                  const visible = visibleLayerIds
                    ? visibleLayerIds.includes(item.id)
                    : item.defaultVisibility;
                  if (item.type === "folder") {
                    return (
                      <li
                        key={item.id}
                        className={`font-semibold text-gray-500 max-w-full truncate`}
                      >
                        {item.label}
                      </li>
                    );
                  } else {
                    if (!item.legend) {
                      if (item.glStyle) {
                        if (styleHasDataExpression(item.glStyle.layers)) {
                          return (
                            <li
                              key={item.id}
                              className={`max-w-full ${
                                visible ? "opacity-100" : "opacity-50"
                              }`}
                            >
                              <div className="flex items-center space-x-1 mb-0.5">
                                <span className="truncate flex-1">
                                  {item.label}
                                </span>
                                <Toggle
                                  onChange={onChangeVisibility(item.id)}
                                  visible={visible}
                                />
                              </div>
                              <ul className="pl-2 text-sm mb-1">
                                <li
                                  className="flex items-center space-x-2"
                                  // key={legendItem.id}
                                ></li>
                              </ul>
                            </li>
                          );
                        } else {
                          return (
                            <li
                              className={`flex items-center space-x-2 max-w-full ${
                                visible ? "opacity-100" : "opacity-50"
                              }`}
                            >
                              <SimpleLegendIconFromStyle
                                style={item.glStyle}
                                map={map}
                              />
                              <span className="truncate flex-1">
                                {item.label}
                              </span>
                              <Toggle
                                onChange={onChangeVisibility(item.id)}
                                visible={visible}
                              />
                            </li>
                          );
                        }
                      } else {
                        return (
                          <li
                            key={item.id}
                            className={`flex items-center space-x-2 max-w-full ${
                              visible ? "opacity-100" : "opacity-50"
                            }`}
                          >
                            <span className="truncate flex-1">
                              {item.label}
                            </span>
                            <Toggle
                              onChange={onChangeVisibility(item.id)}
                              visible={visible}
                            />
                          </li>
                        );
                      }
                    } else if (item.legend && item.legend.length === 1) {
                      const legendItem = item.legend[0];
                      return (
                        <li
                          key={item.id}
                          className={`flex items-center space-x-2 max-w-full ${
                            visible ? "opacity-100" : "opacity-50"
                          }`}
                        >
                          <LegendImage item={legendItem} />
                          <span className="truncate flex-1">{item.label}</span>
                          <Toggle
                            onChange={onChangeVisibility(item.id)}
                            visible={visible}
                          />
                        </li>
                      );
                    } else if (item.legend && item.legend.length > 1) {
                      return (
                        <li
                          key={item.id}
                          className={`max-w-full ${
                            visible ? "opacity-100" : "opacity-50"
                          }`}
                        >
                          <div className="flex items-center space-x-1 mb-0.5">
                            <span className="truncate flex-1">
                              {item.label}
                            </span>
                            <Toggle
                              onChange={onChangeVisibility(item.id)}
                              visible={visible}
                            />
                          </div>
                          <ul className="pl-2 text-sm mb-1">
                            {item.legend.map((legendItem) => {
                              return (
                                <li
                                  className="flex items-center space-x-2"
                                  key={legendItem.id}
                                >
                                  <LegendImage item={legendItem} />
                                  <span className="truncate">
                                    {legendItem.label}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    } else {
                      return null;
                    }
                  }
                })}
              </ul>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </div>
    );
  }
}

function LegendImage({
  item,
  className,
}: {
  item: LegendItem;
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

export function styleHasDataExpression(style: SeaSketchGlLayer[]) {
  for (const layer of style) {
    if (
      style.length > 1 &&
      layer.filter &&
      isExpression(layer.filter) &&
      hasGetExpression(layer.filter, true)
    ) {
      return true;
    } else if (layer.paint) {
      for (const key in layer.paint) {
        if (isExpression((layer.paint as any)[key])) {
          return hasGetExpression((layer.paint as any)[key], key === "filter");
        }
      }
    } else if (layer.layout) {
      for (const key in layer.layout) {
        if (isExpression((layer.layout as any)[key])) {
          return hasGetExpression((layer.layout as any)[key], key === "filter");
        }
      }
    }
  }
  return false;
}

type Expression = [string, Expression | string | number | boolean | null];

const SimpleLegendIconFromStyle = memo(
  function _SimpleLegendIconFromStyle(props: {
    style: {
      layers: Layer[];
      imageList?: ImageList;
    };
    map: Map;
  }) {
    let data: LegendForGLLayers | undefined;
    try {
      data = compileLegendFromGLStyleLayers2(props.style.layers, "vector");
    } catch (e) {
      // Do nothing
    }
    const simpleSymbol = data?.type === "SimpleGLLegend" ? data.symbol : null;
    return (
      <div className="w-5 h-5 flex items-center justify-center bg-transparent">
        {simpleSymbol ? (
          <SimpleSymbol map={props.map} data={simpleSymbol} />
        ) : null}
      </div>
    );
  }
);
