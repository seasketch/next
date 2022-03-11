import { MapIcon } from "@heroicons/react/outline";
import { AnimateSharedLayout } from "framer-motion";
import { motion } from "framer-motion";
import { useEffect, useState, useContext } from "react";
import { Trans } from "react-i18next";
import { MapContext } from "../dataLayers/MapContextManager";
import OptionalBasemapLayerControl from "../dataLayers/OptionalBasemapLayerControl";
import { BasemapDetailsFragment } from "../generated/graphql";

export default function MapPicker({
  basemaps,
  className,
}: {
  basemaps: BasemapDetailsFragment[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const mapContext = useContext(MapContext);
  const selected = mapContext.manager?.getSelectedBasemap();

  useEffect(() => {
    if (open) {
      const listener = () => setOpen(false);
      document.body.addEventListener("click", listener);
      return () => document.body.removeEventListener("click", listener);
    }
  }, [mapContext.manager, open]);

  return (
    <>
      {/* <AnimateSharedLayout> */}
      <div
        className={`MapPicker absolute flex-col flex right-2 top-5 z-50 rounded-md shadow-md bg-opacity-80 hover:shadow-md bg-white ${
          open ? "w-72" : ""
        }`}
        style={{ maxHeight: "calc(100vh - 50px)" }}
      >
        {selected && !open && (
          <motion.button
            layout
            key={selected.id}
            className="block flex items-center p-0.5 overflow-hidden"
            // className="absolute right-2 top-4 z-50 border-white border-opacity-80 border-2  rounded shadow-md hover:shadow-md"
            onClick={() => setOpen((prev) => !prev)}
          >
            <img
              alt={`${selected.name} map preview`}
              src={selected?.thumbnail}
              className="w-16 h-16 rounded"
            />
            {/* <div className="bg-white  absolute right-0 bottom-0 rounded-br rounded-tl bg-opacity-50 p-1">
              <MapIcon className="w-4 left-2 text-black opacity-50" />
            </div> */}
          </motion.button>
        )}
        <div>
          {open &&
            basemaps.map((basemap) => (
              <button
                className={`w-full flex items-center p-2 rounded m-1 max-w-full ${
                  selected?.id === basemap.id ? "font-semibold" : ""
                }`}
                key={basemap.id}
                onClick={(e) => {
                  if (basemap.id === selected?.id) {
                    setOpen((prev) => false);
                  } else {
                    mapContext.manager?.setSelectedBasemap(
                      basemap.id.toString()
                    );
                  }
                  e.stopPropagation();
                }}
              >
                <img
                  alt={`${basemap.name} map preview`}
                  src={basemap.thumbnail}
                  className={`w-12 h-12 rounded ${
                    selected?.id === basemap.id ? "ring-2 ring-blue-500" : ""
                  }`}
                />
                <span className="px-2 ml-1 max-w-full truncate">
                  {basemap.name}
                </span>
              </button>
            ))}
        </div>
        {open &&
          selected?.optionalBasemapLayers &&
          selected.optionalBasemapLayers.length > 0 && (
            <>
              <h4 className="font-medium mb-2 px-3 py-1 border-t border-black border-opacity-10 pt-3 mt-2">
                <Trans ns="surveys">Optional Layers</Trans>
              </h4>

              <div
                className="flex-1 overflow-y-scroll px-3 py-1"
                onClick={(e) => e.stopPropagation()}
              >
                {selected.optionalBasemapLayers.map((lyr) => (
                  <OptionalBasemapLayerControl layer={lyr} />
                ))}
              </div>
            </>
          )}
      </div>
      {/* {open && (
        <div className="absolute right-2 top-4 z-50 p-1 rounded-md shadow-md bg-opacity-80 hover:shadow-md bg-white space-x-1">
          {basemaps.map((basemap) => (
            <button
              key={basemap.id}
              onClick={() => {
                mapContext.manager?.setSelectedBasemap(basemap.id.toString());
                setOpen((prev) => !prev);
              }}
            >
              <img src={basemap.thumbnail} className="w-16 h-16 rounded" />
            </button>
          ))}
        </div>
      )} */}
      {/* </AnimateSharedLayout> */}
    </>
  );
}
