import React, { useState } from "react";
import Spinner from "../../../components/Spinner";
import { useCatalogItems, CatalogItem } from "./arcgis";
import { ArcGISRESTServiceRequestManager } from "@seasketch/mapbox-gl-esri-sources";

export interface ArcGISBrowserColumnProps {
  url: string;
  name: string;
  type:
    | "Root"
    | "Folder"
    | "GPServer"
    | "MapServer"
    | "FeatureServer"
    | "GeometryServer"
    | "GeocodeServer";
  onSelection?: (item: CatalogItem) => void;
  leading?: boolean;
  requestManager: ArcGISRESTServiceRequestManager;
}

export function ArcGISBrowserColumn(props: ArcGISBrowserColumnProps) {
  const { catalogInfo, error, loading } = useCatalogItems(
    props.url,
    props.requestManager
  );
  const [selectedItem, setSelectedItem] = useState<CatalogItem>();
  const updateSelection = (item: CatalogItem) => {
    setSelectedItem(item);
    if (props.onSelection) {
      props.onSelection(item);
    }
  };
  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <Spinner svgClassName="h-8 w-8" />
      </div>
    );
  }
  return (
    <div
      className="border-r min-w-min-content bg-white overflow-y-auto w-40"
      style={{ minWidth: 240 }}
    >
      <ul>
        {catalogInfo?.map((item) => (
          <ServiceItem
            key={`${item.url}`}
            title={item.name}
            onClick={() => updateSelection(item)}
            url={item.url}
            selected={item.url === selectedItem?.url}
            type={item.type}
            leading={props.leading}
          />
        ))}
      </ul>
    </div>
  );
}

function ServiceItem(props: {
  type:
    | "Folder"
    | "MapServer"
    | "FeatureServer"
    | "GPServer"
    | "GeometryServer"
    | "GeocodeServer";
  url: string;
  title: string;
  key: string;
  selected: boolean;
  leading?: boolean;
  onClick?: (e: { id: string; url: string }) => void;
}) {
  const disabled =
    props.type !== "MapServer" &&
    props.type !== "Folder" &&
    props.type !== "FeatureServer";
  /* eslint-disable */
  const svgClassName = `mr-1.5 w-4 -mt-0.5 h-4 inline ${
    props.selected
      ? !!props.leading
        ? "text-white"
        : "text-black"
      : disabled
      ? "text-gray-500"
      : "text-gray-800"
  }`;
  /* eslint-enable */
  return (
    <li
      className={`cursor-pointer text-sm max-w-full truncate ${
        props.selected
          ? `${
              !!props.leading
                ? "bg-primary-600  text-white"
                : "bg-gray-300 text-black"
            }`
          : "bg-white text-black"
      } py-1 px-2 pr-4 ${disabled && "pointer-events-none text-gray-500"}`}
      onClick={() =>
        props.onClick && props.onClick({ id: props.url, url: props.url })
      }
    >
      {props.type === "MapServer" && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          className={svgClassName}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      )}
      {props.type === "FeatureServer" && (
        <svg
          viewBox="0 0 448 512"
          height="48"
          width="48"
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={svgClassName}
        >
          <path
            fill="currentColor"
            d="M384 352c-.35 0-.67.1-1.02.1l-39.2-65.32c5.07-9.17 8.22-19.56 8.22-30.78s-3.14-21.61-8.22-30.78l39.2-65.32c.35.01.67.1 1.02.1 35.35 0 64-28.65 64-64s-28.65-64-64-64c-23.63 0-44.04 12.95-55.12 32H119.12C108.04 44.95 87.63 32 64 32 28.65 32 0 60.65 0 96c0 23.63 12.95 44.04 32 55.12v209.75C12.95 371.96 0 392.37 0 416c0 35.35 28.65 64 64 64 23.63 0 44.04-12.95 55.12-32h209.75c11.09 19.05 31.49 32 55.12 32 35.35 0 64-28.65 64-64 .01-35.35-28.64-64-63.99-64zm-288 8.88V151.12A63.825 63.825 0 00119.12 128h208.36l-38.46 64.1c-.35-.01-.67-.1-1.02-.1-35.35 0-64 28.65-64 64s28.65 64 64 64c.35 0 .67-.1 1.02-.1l38.46 64.1H119.12A63.748 63.748 0 0096 360.88zM272 256c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zM400 96c0 8.82-7.18 16-16 16s-16-7.18-16-16 7.18-16 16-16 16 7.18 16 16zM64 80c8.82 0 16 7.18 16 16s-7.18 16-16 16-16-7.18-16-16 7.18-16 16-16zM48 416c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zm336 16c-8.82 0-16-7.18-16-16s7.18-16 16-16 16 7.18 16 16-7.18 16-16 16z"
          ></path>
        </svg>
      )}
      {props.type === "GPServer" && (
        <svg
          className={svgClassName}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        </svg>
      )}
      {props.type === "GeocodeServer" && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          className={svgClassName}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      {/* {props.type === "Folder" && <FolderIcon className="mr-2" />} */}
      <span>{props.title}</span>
    </li>
  );
}
