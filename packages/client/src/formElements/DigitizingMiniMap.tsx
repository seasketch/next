import { useEffect, useRef, useState } from "react";
import mapboxgl, { Map, Style } from "mapbox-gl";
import { DigitizingDragTarget } from "../draw/useMapboxGLDraw";
import { motion } from "framer-motion";
import { useMediaQuery } from "beautiful-react-hooks";

const ZOOM_MULTIPLIER = 1.18;

export default function DigitizingMiniMap({
  style,
  dragTarget,
  onLoad,
  topologyErrors,
}: {
  style: Style;
  dragTarget?: DigitizingDragTarget | null;
  onLoad?: (map: Map | null) => void;
  topologyErrors?: boolean;
}) {
  const isSmall = useMediaQuery("(max-width: 767px)");
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<Map | null>(null);
  useEffect(() => {
    if (mapContainer.current) {
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: style,
        center: dragTarget?.center || [-119, 31],
        zoom: dragTarget?.currentZoom
          ? Math.min(dragTarget.currentZoom * ZOOM_MULTIPLIER, 18)
          : 15,
        attributionControl: false,
        logoPosition: "top-right",
      });
      setMap(mapInstance);
      if (onLoad) {
        mapInstance.on("load", onLoad);
      }

      return () => {
        if (onLoad) {
          mapInstance.off("load", onLoad);
          onLoad(null);
        }
        setMap(null);
        mapInstance?.remove();
      };
    }
  }, [mapContainer.current]);
  useEffect(() => {
    if (map) {
      map.setStyle(style, { diff: false });
      map.resize();
    }
  }, [style]);
  useEffect(() => {
    if (map && dragTarget) {
      map.setCenter(dragTarget.center);
      map.setZoom(Math.min(dragTarget.currentZoom * ZOOM_MULTIPLIER, 18));
    }
  }, [dragTarget]);
  const variant =
    dragTarget && dragTarget.point.y < 175 && dragTarget.point.x < 175
      ? "topRight"
      : "topLeft";

  const padding = isSmall ? 8 : 16;
  const width = isSmall ? 144 : 160;
  return (
    <motion.div
      initial={false}
      variants={{
        topLeft: { opacity: 1, left: padding, top: padding },
        topRight: {
          opacity: 1,
          left: document.body.clientWidth - width - padding,
          top: padding,
        },
        hidden: {
          opacity: 0,
          transition: {
            delay: 0.25,
          },
          top: padding,
        },
      }}
      animate={dragTarget ? variant : "hidden"}
      className={`w-36 h-36 md:w-40 md:h-40 rounded-full overflow-hidden z-20 md:m-1 absolute shadow-2xl ring-4 pointer-events-none ${
        topologyErrors ? "ring-red-500" : ""
      }`}
    >
      <div
        ref={mapContainer}
        className="w-full h-full minimap hide-all-gl-controls"
      ></div>
      <svg
        viewBox="0 0 24 24"
        focusable="false"
        role="img"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-1/2 top-1/2 z-30 w-8 h-8 text-black opacity-50"
        style={{ marginLeft: -15.5, marginTop: -15 }}
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="22" x2="18" y1="12" y2="12"></line>
        <line x1="6" x2="2" y1="12" y2="12"></line>
        <line x1="12" x2="12" y1="6" y2="2"></line>
        <line x1="12" x2="12" y1="22" y2="18"></line>
      </svg>
      <svg
        viewBox="0 0 24 24"
        focusable="false"
        role="img"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-1/2 top-1/2 z-30 w-8 h-8 text-white opacity-90"
        style={{ marginLeft: -16, marginTop: -16 }}
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="22" x2="18" y1="12" y2="12"></line>
        <line x1="6" x2="2" y1="12" y2="12"></line>
        <line x1="12" x2="12" y1="6" y2="2"></line>
        <line x1="12" x2="12" y1="22" y2="18"></line>
      </svg>
      {/* <div
        className="bg-black left-1/2 top-1/2 z-50 absolute"
        style={{ width: 1, height: 1, marginLeft: -1, marginTop: -1 }}
      ></div> */}
    </motion.div>
  );
}
