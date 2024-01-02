import mapboxgl, { Map, MapboxOptions } from "mapbox-gl";
import ReactDOM, { createPortal } from "react-dom";
import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  ReactNode,
} from "react";
import { MapContext } from "../dataLayers/MapContextManager";
import { motion, AnimatePresence } from "framer-motion";
import "mapbox-gl/dist/mapbox-gl.css";
import Spinner from "./Spinner";
import { Trans } from "react-i18next";
import { currentSidebarState } from "../projects/ProjectAppSidebar";
import MapBookmarkDetailsOverlay from "./MapBookmarkDetailsOverlay";
import MapSettingsPopup from "../draw/MapSettingsPopup";
import { CogIcon } from "@heroicons/react/outline";
import { MeasurementToolsOverlay } from "../MeasureControl";
import SidebarPopup from "../dataLayers/SidebarPopup";

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
  lazyLoadReady?: boolean;
  navigationControlsLocation?:
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left";
  mapSettingsPopupActions?: ReactNode;
  onRequestSidebarClose?: () => void;
}

mapboxgl.prewarm();

export default React.memo(function MapboxMap(props: OverlayMapProps) {
  const [map, setMap] = useState<Map>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapContext = useContext(MapContext);
  const [showSpinner, setShowSpinner] = useState(true);
  const [mapSettingsPopupOpen, setMapSettingsPopupOpen] = useState(false);
  const [showBookmarkOverlayId, setShowBookmarkOverlayId] = useState<
    string | null
  >(null);

  const interactive =
    props.interactive === undefined ? true : props.interactive;

  const sidebar = currentSidebarState();

  useEffect(() => {
    if (
      !map &&
      mapContainer.current &&
      mapContext.manager &&
      mapContext.ready &&
      (props.lazyLoadReady === undefined || props.lazyLoadReady === true)
    ) {
      let cancelled = false;
      const container = mapContainer.current;
      mapContext.manager
        .createMap(mapContainer.current, props.bounds, props.initOptions)
        .then((map) => {
          if (!cancelled && map) {
            setMap(map);
            if (props.showNavigationControls) {
              map.addControl(
                new mapboxgl.NavigationControl(),
                props.navigationControlsLocation || "top-left"
              );
            }
            map.on("load", () => {
              setShowSpinner(false);
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
  }, [map, mapContext.manager, mapContext.selectedBasemap, mapContainer.current, mapContext.ready, props.lazyLoadReady]);

  const mapSettingsPopupAnchor = useRef<HTMLButtonElement>(null);
  const surveys = /surveys/.test(window.location.pathname);
  let measurementToolsPlacement: string =
    props.navigationControlsLocation || "top-right";
  if (
    !/surveys/.test(window.location.pathname) &&
    measurementToolsPlacement === "top-right"
  ) {
    measurementToolsPlacement = "bottom-right";
  }
  return (
    <div
      className={`flex-1 bg-gray-300 ${props.className} ${props.hideDrawControls ? "hide-draw-controls" : ""
        } ${!interactive ? "non-interactive" : ""}`}
      ref={mapContainer}
      onClick={!interactive ? props.onClickNonInteractive : undefined}
    >
      {createPortal(<SidebarPopup onClose={() => {
        if (mapContext?.manager?.interactivityManager) {
          mapContext.manager.interactivityManager.clearSidebarPopup();
        }
      }} content={mapContext.sidebarPopupContent} title={mapContext.sidebarPopupTitle} />, document.body)}
      {props.mapSettingsPopupActions && (
        <MapSettingsPopup
          open={mapSettingsPopupOpen}
          onRequestClose={() => setMapSettingsPopupOpen(false)}
          anchor={mapSettingsPopupAnchor.current || undefined}
        >
          {props.mapSettingsPopupActions}
        </MapSettingsPopup>
      )}
      <MeasurementToolsOverlay
        // @ts-ignore
        placement={measurementToolsPlacement}
      />

      {props.mapSettingsPopupActions && (
        <button
          ref={mapSettingsPopupAnchor}
          style={{ zIndex: 1, padding: 5 }}
          onClick={() => {
            if (props.onRequestSidebarClose) {
              props.onRequestSidebarClose();
            }
            setMapSettingsPopupOpen(true);
          }}
          className={`absolute bg-white ring-2 ring-black ring-opacity-10 rounded top-28 ${props.navigationControlsLocation === "top-right"
            ? "right-2.5"
            : "left-2.5"
            }`}
        >
          <CogIcon className="w-5 h-5" />
        </button>
      )}
      <div
        className={`w-full h-full absolute top-0 left-0  z-10 pointer-events-none duration-500 transition-opacity flex items-center justify-center ${mapContext.showLoadingOverlay ? "opacity-100" : "opacity-0"
          }`}
        style={{ backdropFilter: "blur(12px)" }}
      >
        <div className="bg-gray-100 bg-opacity-30 text-blue-800 border-blue-800 border-opacity-20 shadow-inner border text-base p-4 rounded-full flex items-center">
          <span>{mapContext.loadingOverlay}</span>
          <Spinner color="white" className="ml-2" />
        </div>
      </div>
      {showSpinner && (
        <Spinner className="absolute top-1/2 left-1/2 -ml-5 -mt-5" large />
      )}
      <div className="w-full absolute top-0 z-10 items-center justify-center">
        <AnimatePresence>
          {mapContext.offlineTileSimulatorActive ? (
            <motion.div
              initial={{ opacity: 0, translateY: -40 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -40 }}
              transition={{ duration: 0.2 }}
              className="text-lg p-0.5 px-4 py-2"
              style={{
                backgroundColor: "orange",
              }}
            >
              <Trans ns="admin:offline">Offline Tile Simulator Active</Trans>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
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
      <div
        className="flex justify-center items-center absolute top-0 left-0 text-xs z-10 pointer-events-none w-full"
        style={
          sidebar.open
            ? {
              paddingLeft: sidebar.width + "px",
            }
            : {}
        }
      >
        <AnimatePresence>
          {mapContext.displayedMapBookmark ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-sm px-4 pointer-events-auto mt-2 p-2 rounded"
              style={{
                backgroundColor: "rgba(255,255,255,0.5)",
              }}
              onMouseEnter={() => {
                mapContext?.manager?.cancelBookmarkBannerHiding();
              }}
              onMouseLeave={() => {
                mapContext?.manager?.hideBookmarkBanner(1000);
              }}
            >
              {mapContext.displayedMapBookmark.errors.missingBasemap ||
                mapContext.displayedMapBookmark.errors.missingLayers.length > 0 ||
                mapContext.displayedMapBookmark.errors.missingSketches.length >
                0 ? (
                <Trans
                  ns="map"
                  i18nKey="missingLayerCount"
                  count={
                    (mapContext.displayedMapBookmark.errors.missingBasemap
                      ? 1
                      : 0) +
                    mapContext.displayedMapBookmark.errors.missingLayers
                      .length +
                    mapContext.displayedMapBookmark.errors.missingSketches
                      .length
                  }
                />
              ) : (
                <Trans ns="map">Map bookmark shown</Trans>
              )}
              <button
                className="px-1 bg-gray-100 rounded-sm shadow ml-1"
                onClick={() => {
                  mapContext.manager?.undoMapBookmark();
                }}
              >
                <Trans ns="map">undo</Trans>
              </button>
              <button
                className="px-1 bg-gray-100 rounded-sm shadow ml-1 -mr-1.5"
                onClick={() =>
                  setShowBookmarkOverlayId(
                    mapContext.displayedMapBookmark?.id || null
                  )
                }
              >
                <Trans ns="map">view details</Trans>
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {showBookmarkOverlayId && (
        <MapBookmarkDetailsOverlay
          bookmarkId={showBookmarkOverlayId}
          onRequestClose={() => setShowBookmarkOverlayId(null)}
        />
      )}
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
});

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
      className="absolute z-50 bg-white p-1 px-2 shadow-lg rounded text-sm"
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
