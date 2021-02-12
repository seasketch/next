import React, { useContext, useEffect, useState } from "react";
import Button from "../../components/Button";
import { MapContext } from "../../dataLayers/MapContextManager";
import { Basemap, useGetBasemapsQuery } from "../../generated/graphql";
import { useMapboxStyle } from "../../useMapboxStyle";
import useProjectId from "../../useProjectId";
import BasemapEditorPanel from "./BasemapEditorPanel";
import CreateBasemapModal from "./CreateBasemapModal";

export default function BaseMapEditor() {
  const managerContext = useContext(MapContext);
  const projectId = useProjectId();
  const { data, loading, error } = useGetBasemapsQuery({
    variables: {
      projectId: projectId!,
    },
  });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    if (data?.project?.basemaps && managerContext.manager) {
      managerContext.manager.setBasemaps(data.project.basemaps);
    }
  }, [data?.project?.basemaps, managerContext.manager]);
  return (
    <>
      <div className="p-4">
        <div className="mb-4">
          <Button
            small
            label="Add basemap"
            onClick={() => setAddModalOpen(true)}
          />
          <Button
            className="ml-2"
            small
            disabled={!managerContext.selectedBasemap}
            label="Edit basemap"
            onClick={() => setEditModalOpen(true)}
          />
        </div>
        {addModalOpen && (
          <CreateBasemapModal onRequestClose={() => setAddModalOpen(false)} />
        )}
        <div className="w-full flex flex-wrap justify-center">
          {data?.project?.basemaps?.map((b) => (
            <BasemapSquareItem
              selected={managerContext.selectedBasemap === b.id.toString()}
              key={b.id}
              basemap={b}
              onClick={() => {
                // if (selectedBasemap !== b.id) {
                managerContext.manager?.setSelectedBasemap(b.id.toString());
                // setSelectedBasemap(b.id);
                // managerContext.manager?.changeBasemap(b.url);
                // }
              }}
            />
          ))}
        </div>
      </div>
      {editModalOpen && managerContext.selectedBasemap && (
        <BasemapEditorPanel
          onRequestClose={() => setEditModalOpen(false)}
          basemapId={parseInt(managerContext.selectedBasemap)}
        />
      )}
    </>
  );
}

function BasemapSquareItem({
  basemap,
  selected,
  onClick,
}: {
  basemap: { name: string; thumbnail: string; id: number };
  selected: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col m-2 cursor-pointer" onClick={onClick}>
      <div
        className={`w-32 h-32 rounded-md mb-1 ${
          selected ? "ring-4 ring-blue-500 shadow-xl" : "shadow-md"
        }`}
        style={{
          background: `grey url(${basemap.thumbnail})`,
          backgroundSize: "cover",
        }}
      >
        &nbsp;
      </div>
      <h4
        className={`w-32 truncate text-center font-medium  text-sm px-2 ${
          selected ? "text-gray-800 " : "text-gray-600"
        }`}
      >
        {basemap.name}
      </h4>
    </div>
  );
}
