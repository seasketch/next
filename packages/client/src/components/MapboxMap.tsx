import mapboxgl, { ErrorEvent, Map, MapDataEvent } from "mapbox-gl";
import ReactDOM from "react-dom";
import React, { useEffect, useState, useRef, useContext } from "react";
import {
  LayerManagerContext,
  useLayerManager,
} from "../dataLayers/LayerManager";

export interface OverlayMapProps {
  onLoad?: (map: Map) => void;
  className?: string;
}

mapboxgl.prewarm();

export default function OverlayMap(props: OverlayMapProps) {
  const [map, setMap] = useState<Map>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const layerManager = useContext(LayerManagerContext);

  useEffect(() => {
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;
    if (!map) {
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/underbluewaters/ckjt51pq400be19mvalqmrumc", // stylesheet location
        // style: "mapbox://styles/mapbox/satellite-streets-v11", // stylesheet location
        center: [1.9, 18.7],
        zoom: 0.09527381899319892,
      });
      mapInstance.on("load", () => {
        setMap(mapInstance);
        // @ts-ignore
        window.map = mapInstance;
        // mapInstance.addSource("mapbox-dem", {
        //   type: "raster-dem",
        //   url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        //   tileSize: 512,
        //   maxzoom: 14,
        // });
        // // @ts-ignore
        // mapInstance.setTerrain({ source: "mapbox-dem", exaggeration: 1 });

        mapInstance.addLayer({
          id: "sky",
          // @ts-ignore
          type: "sky",
          paint: {
            // @ts-ignore
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 0.0],
            "sky-atmosphere-sun-intensity": 15,
          },
        });
        mapInstance.resize();
        setTimeout(() => {
          mapInstance.resize();
        }, 200);
        if (props.onLoad) {
          props.onLoad(mapInstance);
        }
      });
    }
  }, [map]);

  return (
    <div
      className={`flex-1 bg-gray-900 ${props.className} relative`}
      ref={mapContainer}
    >
      <div className="flex align-middle justify-center absolute top-2 z-10 w-full">
        {layerManager.bannerMessages?.length ? (
          <div
            className="mb-2 rounded-md text-sm bg-white bg-opacity-70 p-2"
            dangerouslySetInnerHTML={{
              __html: layerManager.bannerMessages.join(","),
            }}
          />
        ) : null}
      </div>
      {layerManager.tooltip ? (
        <Tooltip x={layerManager.tooltip.x} y={layerManager.tooltip.y}>
          <div
            dangerouslySetInnerHTML={{
              __html: layerManager.tooltip.messages.join(","),
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
