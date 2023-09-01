/* eslint-disable i18next/no-literal-string */
import {
  CaretDownIcon,
  EyeClosedIcon,
  EyeOpenIcon,
} from "@radix-ui/react-icons";
import {
  DataTableOfContentsItem,
  FolderTableOfContentsItem,
  LegendItem,
} from "@seasketch/mapbox-gl-esri-sources";
import * as Accordion from "@radix-ui/react-accordion";
import Spinner from "../../../components/Spinner";
require("./Accordion.css");

export default function ArcGISCartLegend({
  items,
  className,
  loading,
  visibleLayerIds,
  toggleLayer,
}: {
  className?: string;
  items: (FolderTableOfContentsItem | DataTableOfContentsItem)[];
  loading?: boolean;
  visibleLayerIds?: string[];
  toggleLayer?: (id: string) => void;
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
        <Accordion.Root type="single" collapsible>
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
                      return (
                        <li
                          className={`${
                            visible ? "text-black" : "text-gray-400"
                          }`}
                        >
                          {item.label}
                        </li>
                      );
                    } else if (item.legend && item.legend.length === 1) {
                      const legendItem = item.legend[0];
                      return (
                        <li
                          key={item.id}
                          className={`flex items-center space-x-2 max-w-full ${
                            visible ? "text-black" : "text-gray-400"
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
                            visible ? "text-black" : "text-gray-400"
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
