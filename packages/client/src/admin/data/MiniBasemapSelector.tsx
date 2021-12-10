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
      {/* <button className="rounded p-1 bg-gray-200 text-gray-800">
        <svg
          viewBox="0 0 16 16"
          className="w-6 h-6"
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8.235 1.559a.5.5 0 0 0-.47 0l-7.5 4a.5.5 0 0 0 0 .882L3.188 8 .264 9.559a.5.5 0 0 0 0 .882l7.5 4a.5.5 0 0 0 .47 0l7.5-4a.5.5 0 0 0 0-.882L12.813 8l2.922-1.559a.5.5 0 0 0 0-.882l-7.5-4zm3.515 7.008L14.438 10 8 13.433 1.562 10 4.25 8.567l3.515 1.874a.5.5 0 0 0 .47 0l3.515-1.874zM8 9.433 1.562 6 8 2.567 14.438 6 8 9.433z"></path>
        </svg>
      </button> */}
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
