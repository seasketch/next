import mapboxgl, { Map, MapboxOptions } from "mapbox-gl";
import ReactDOM from "react-dom";
import React, { useEffect, useState, useRef, useContext } from "react";
import { MapContext } from "../dataLayers/MapContextManager";
import { motion, AnimatePresence } from "framer-motion";
import "mapbox-gl/dist/mapbox-gl.css";

export interface OverlayMapProps {
  onLoad?: (map: Map) => void;
  className?: string;
  bounds?: [number, number, number, number];
  initOptions?: Partial<MapboxOptions>;
  hideDrawControls?: boolean;
  showNavigationControls?: boolean;
  /** Defaults to true */
  interactive?: boolean;
  onClickNonInteractive?: () => void;
}

mapboxgl.prewarm();

export default function MapboxMap(props: OverlayMapProps) {
  const [map, setMap] = useState<Map>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapContext = useContext(MapContext);

  const interactive =
    props.interactive === undefined ? true : props.interactive;

  useEffect(() => {
    if (
      !map &&
      mapContainer.current &&
      mapContext.manager &&
      mapContext.ready
    ) {
      let cancelled = false;
      const container = mapContainer.current;
      mapContext.manager
        .createMap(mapContainer.current, props.bounds, props.initOptions)
        .then((map) => {
          if (!cancelled && map) {
            setMap(map);
            if (props.showNavigationControls) {
              map.addControl(new mapboxgl.NavigationControl(), "top-left");
            }
            map.on("load", () => {
              if (!cancelled) {
                map.resize();
                if (props.onLoad) {
                  props.onLoad(map);
                }
              } else {
                console.warn("cancelled map load (on load)");
              }
            });
          } else {
            console.warn("cancelled map load");
          }
        });
      return () => {
        if (container !== mapContainer.current) {
          cancelled = true;
        }
      };
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
      className={`flex-1 bg-gray-300 ${props.className} ${
        props.hideDrawControls ? "hide-draw-controls" : ""
      } ${!interactive ? "non-interactive" : ""}`}
      ref={mapContainer}
      onClick={!interactive ? props.onClickNonInteractive : undefined}
    >
      <div className="flex justify-center absolute top-0 right-1/2 text-xs z-10 pointer-events-none">
        <AnimatePresence>
          {mapContext.bannerMessages?.length ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-sm p-0.5 w-full px-4 "
              style={{
                backgroundColor: "rgba(255,255,255,0.5)",
                // backgroundImage:
                //   "linear-gradient(to right, rgba(255,255,255,0.5), rgba(255,255,255,0.5), rgba(255,255,255,0))",
              }}
              dangerouslySetInnerHTML={{
                __html: mapContext.bannerMessages.join(","),
              }}
            />
          ) : null}
        </AnimatePresence>
      </div>
      {mapContext.basemapError && (
        <div className="flex w-full absolute top-1 place-content-center z-10 text-center">
          <div className=" bg-red-900 text-white p-1 text-sm">
            {
              //eslint-disable-next-line
            }
            Basemap Error: {mapContext.basemapError.message}
          </div>
        </div>
      )}
      <AnimatePresence>
        <Tooltip
          visible={!!mapContext.tooltip}
          x={mapContext.tooltip?.x}
          y={mapContext.tooltip?.y}
          content={
            mapContext.tooltip ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: mapContext.tooltip?.messages.join(",") || "",
                }}
              ></div>
            ) : undefined
          }
        ></Tooltip>
      </AnimatePresence>
    </div>
  );
}
// TODO: Keep tooltip around and hide/show it so that framer-motion can be used
// to animate entry *and exit* and tween between x and y position.
function Tooltip({
  x,
  y,
  visible,
  content,
}: {
  x?: number;
  y?: number;
  content?: React.ReactNode;
  visible: boolean;
}) {
  const [state, setState] = useState<{
    x: number;
    y: number;
    children: React.ReactNode;
  }>({ x: 0, y: 0, children: "" });

  useEffect(() => {
    if (x && y) {
      setState({ x, y, children: content });
    }
  }, [x, y, content]);

  return ReactDOM.createPortal(
    <motion.div
      transition={{
        scale: { type: "spring", stiffness: 200 },
        default: { duration: 0.1 },
      }}
      className="absolute z-10 bg-white p-1 px-2 shadow-lg rounded text-sm"
      style={{ left: state.x + 15, top: state.y + 15 }}
      animate={visible ? "visible" : "hidden"}
      variants={{
        hidden: {
          scale: 0.5,
          opacity: 0,
          transition: {
            type: "easeOut",
            duration: 0.3,
          },
        },
        visible: {
          scale: 1,
          opacity: 1,
          transition: {
            type: "spring",
            stiffness: 300,
            duration: 0.1,
          },
        },
      }}
      // animate={{
      //   opacity: visible ? 1 : 0,
      //   scale: visible ? 1 : 0.5,
      //   // @ts-ignore
      //   // left: state.x + 15,
      //   // top: state.y + 15,
      // }}
    >
      {state.children}
    </motion.div>,
    document.getElementById("tooltip-container")!
  );
}
