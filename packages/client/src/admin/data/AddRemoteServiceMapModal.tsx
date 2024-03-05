import { Map } from "mapbox-gl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import getSlug from "../../getSlug";
import { useProjectRegionQuery } from "../../generated/graphql";
import bbox from "@turf/bbox";

export const STYLE = "mapbox://styles/seasketch/cl892c7ia001e14qpbr4gnf4k";

export default function AddRemoteServiceMapModal({
  onMapLoad,
  onRequestClose,
  title,
  children,
  transformRequest,
}: {
  onMapLoad: (map: Map) => void;
  onRequestClose: () => void;
  title: string;
  children: React.ReactNode;
  transformRequest?: mapboxgl.TransformRequestFunction;
}) {
  const projectMetadataQuery = useProjectRegionQuery({
    variables: {
      slug: getSlug(),
    },
  });
  const [mapDiv, setMapDiv] = useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<Map | null>(null);

  useEffect(() => {
    if (mapDiv) {
      if (map) {
        map.remove();
      }
      // initialize mapbox map
      const m = new Map({
        container: mapDiv,
        style: STYLE,
        bounds: projectMetadataQuery.data?.projectBySlug
          ? (bbox(projectMetadataQuery.data.projectBySlug.region.geojson) as [
              number,
              number,
              number,
              number
            ])
          : undefined,
        transformRequest,
      });

      m.on("load", () => {
        m.resize();
        setMap(m);
        onMapLoad(m);
      });
    }
  }, [mapDiv]);
  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onRequestClose}
      />
      <div className="z-50 pointer-events-none absolute bg-transparent left-0 top-0 w-screen h-screen flex items-center justify-center">
        <div className="bg-white w-3/4 h-3/4 pointer-events-auto shadow-lg rounded-lg flex flex-col items-center justify-center">
          <div className="flex flex-col w-full bg-gray-100 rounded-t-md p-4 font-semibold shadow z-10">
            {title}
          </div>
          <div className="flex-1 bg-green-200 w-full flex overflow-hidden relative">
            <div className="bg-white border-r w-96 flex flex-col">
              {children}
            </div>
            <div ref={setMapDiv} className={`bg-gray-50 flex-1`}></div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
