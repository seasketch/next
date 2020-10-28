import mapboxgl, { ErrorEvent, Map, MapDataEvent } from "mapbox-gl";
import React, { useEffect, useState, useRef } from "react";
import { useLayerManager } from "../../../dataLayers/LayerManager";
// import OverlayManager from "./OverlayManager";

export interface OverlayMapProps {
  onLoad?: (map: Map) => void;
  onData?: (e: MapDataEvent) => void;
  onDataLoading?: (e: MapDataEvent) => void;
  onError?: (e: ErrorEvent & MapDataEvent) => void;
}

export default function OverlayMap(props: OverlayMapProps) {
  const [map, setMap] = useState<Map>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const layerManager = useLayerManager();

  useEffect(() => {
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;
    if (!map) {
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v11", // stylesheet location
        center: [1.9, 18.7],
        zoom: 0.09527381899319892,
      });
      mapInstance.on("load", () => {
        setMap(mapInstance);
        mapInstance.resize();
        setTimeout(() => {
          mapInstance.resize();
        }, 200);
        if (props.onLoad) {
          props.onLoad(mapInstance);
        }
        // if (props.onError) {
        //   mapInstance.on("error", props.onError);
        // }
        // if (props.onDataLoading) {
        //   mapInstance.on("dataloading", props.onDataLoading);
        // }
        // if (props.onData) {
        //   mapInstance.on("data", props.onData);
        // }
        // @ts-ignore
        window.map = mapInstance;
      });
    }
  }, [map]);

  return (
    <div className="flex-1 bg-gray-900" ref={mapContainer}>
      Map
    </div>
  );
}
