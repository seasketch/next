import mapboxgl, { Map } from "mapbox-gl";
import React, { useEffect, useState, useRef } from "react";
import OverlayManager from "./OverlayManager";

export interface OverlayMapProps {
  onLoad?: (map: Map, overlayManager: OverlayManager) => void;
}

export default function OverlayMap(props: OverlayMapProps) {
  const [map, setMap] = useState<Map>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const [overlayManager, setOverlayManager] = useState<OverlayManager>();

  useEffect(() => {
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;
    if (!map && mapContainer.current) {
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
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
        const manager = new OverlayManager(mapInstance, []);
        setOverlayManager(manager);
        if (props.onLoad) {
          props.onLoad(mapInstance, manager);
        }
      });
    }
  }, [map, mapContainer.current]);

  return (
    <div className="flex-1 bg-gray-900" ref={mapContainer}>
      Map
    </div>
  );
}
