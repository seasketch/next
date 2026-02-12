import { useMediaQuery } from "beautiful-react-hooks";
import { useState, useContext, useRef, FunctionComponent } from "react";
import { MapManagerContext } from "../dataLayers/MapContextManager";
import MapSettingsPopup, { BasemapControl } from "../draw/MapSettingsPopup";
import { BasemapDetailsFragment } from "../generated/graphql";

const MapPicker: FunctionComponent<{
  basemaps: BasemapDetailsFragment[];
  className?: string;
}> = ({ basemaps, className, children }) => {
  const [open, setOpen] = useState(false);
  const { manager } = useContext(MapManagerContext);
  const selected = manager?.getSelectedBasemap();
  const isPhone = useMediaQuery("(max-width: 767px)");
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <div
        className={`MapPicker absolute flex-col flex z-30 shadow-md hover:shadow-md bg-white ${"w-auto right-2 top-5 rounded-md bg-opacity-80"}`}
        style={{ maxHeight: isPhone ? "" : "calc(100vh - 50px)" }}
      >
        {
          <button
            ref={anchor}
            className="flex items-center p-0.5 overflow-hidden"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
          >
            <img
              alt={`${selected?.name} map preview`}
              src={selected?.thumbnail}
              className="w-16 h-16 xl:w-20 xl:h-20 rounded"
            />
          </button>
        }
      </div>
      <MapSettingsPopup
        anchor={anchor.current || undefined}
        open={open}
        onRequestClose={() => setOpen(false)}
        position="bottom"
      >
        {children}
        {children && (
          <hr className="my-3 w-full mx-auto dark:border-gray-500" />
        )}
        <BasemapControl basemaps={basemaps} />
      </MapSettingsPopup>
    </>
  );
};

export default MapPicker;
