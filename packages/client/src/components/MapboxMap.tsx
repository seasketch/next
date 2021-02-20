import mapboxgl, { ErrorEvent, Map, MapDataEvent } from "mapbox-gl";
import ReactDOM from "react-dom";
import React, { useEffect, useState, useRef, useContext } from "react";
import { MapContext, useMapContext } from "../dataLayers/MapContextManager";

export interface OverlayMapProps {
  onLoad?: (map: Map) => void;
  className?: string;
  bounds?: [number, number, number, number];
}

mapboxgl.prewarm();

export default function MapboxMap(props: OverlayMapProps) {
  const [map, setMap] = useState<Map>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapContext = useContext(MapContext);

  useEffect(() => {
    if (
      !map &&
      mapContainer.current &&
      mapContext.manager &&
      mapContext.ready
    ) {
      mapContext.manager
        .createMap(mapContainer.current, props.bounds)
        .then((map) => {
          setMap(map);
          map.on("load", () => {
            map.resize();
            if (props.onLoad) {
              props.onLoad(map);
            }
          });
        });
    }
  }, [
    map,
    mapContext.manager,
    mapContext.selectedBasemap,
    mapContainer.current,
    mapContext.ready,
  ]);

  return (
    <div
      className={`flex-1 bg-gray-300 ${props.className} relative`}
      ref={mapContainer}
    >
      <div className="flex align-middle justify-center absolute top-2 z-10 w-full">
        {mapContext.bannerMessages?.length ? (
          <div
            className="mb-2 rounded-md text-sm bg-white bg-opacity-70 p-2"
            dangerouslySetInnerHTML={{
              __html: mapContext.bannerMessages.join(","),
            }}
          />
        ) : null}
      </div>
      {mapContext.basemapError && (
        <div className="flex w-full absolute top-1 place-content-center z-10 text-center">
          <div className=" bg-red-900 text-white p-1 text-sm">
            Basemap Error: {mapContext.basemapError.message}
          </div>
        </div>
      )}
      {mapContext.tooltip ? (
        <Tooltip x={mapContext.tooltip.x} y={mapContext.tooltip.y}>
          <div
            dangerouslySetInnerHTML={{
              __html: mapContext.tooltip.messages.join(","),
            }}
          ></div>
        </Tooltip>
      ) : null}
    </div>
  );
}

function Tooltip(props: { x: number; y: number; children: React.ReactNode }) {
  return ReactDOM.createPortal(
    <div
      className="absolute z-10 bg-white p-1 px-2 shadow rounded text-sm"
      style={{ left: props.x + 15, top: props.y + 15 }}
    >
      {props.children}
    </div>,
    document.getElementById("tooltip-container")!
  );
}
