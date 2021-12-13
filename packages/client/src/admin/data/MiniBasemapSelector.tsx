import React, { useState, useContext } from "react";
import { ClientBasemap, MapContext } from "../../dataLayers/MapContextManager";

export default function MiniBasemapSelector({
  basemaps,
}: {
  basemaps: ClientBasemap[];
}) {
  const [open, setOpen] = useState(false);
  const mapContext = useContext(MapContext);
  const selected = mapContext.manager?.getSelectedBasemap();
  return (
    <div className="absolute left-2 top-2 z-10">
      {selected && !open && (
        <button
          className="border-primary-500 rounded border-2 shadow-md m-2"
          onClick={() => setOpen(true)}
        >
          <img
            alt={selected.name}
            src={selected.thumbnail}
            className="w-12 h-12"
          />
        </button>
      )}
      {open && (
        <div className="max-w-lg">
          {basemaps.map((b) => (
            <button
              onClick={() => {
                mapContext.manager?.setSelectedBasemap(b.id.toString());
                setOpen(false);
              }}
              className={`${
                selected?.id === b.id
                  ? "border-primary-500 border-2"
                  : "border-black border-2"
              } rounded m-2 shadow-md`}
            >
              <img src={b.thumbnail} className="w-12 h-12" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
