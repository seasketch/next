import mapboxgl, { ErrorEvent, Map, MapDataEvent } from "mapbox-gl";
import React, { useEffect, useState, useRef } from "react";

export interface OverlayMapProps {
  onLoad?: (map: Map) => void;
  className?: string;
}

export default function OverlayMap(props: OverlayMapProps) {
  const [map, setMap] = useState<Map>();
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;
    if (!map) {
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v11", // stylesheet location
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
    <div className={`flex-1 bg-gray-900 ${props.className}`} ref={mapContainer}>
      Map
    </div>
  );
}
