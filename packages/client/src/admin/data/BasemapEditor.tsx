import React, { useContext, useState } from "react";
import Button from "../../components/Button";
import { LayerManagerContext } from "../../dataLayers/LayerManager";
import { Basemap, useGetBasemapsQuery } from "../../generated/graphql";
import useProjectId from "../../useProjectId";
import CreateBasemapModal from "./CreateBasemapModal";

export default function BaseMapEditor() {
  const managerContext = useContext(LayerManagerContext);
  const projectId = useProjectId();
  const { data, loading, error } = useGetBasemapsQuery({
    variables: {
      projectId: projectId!,
    },
  });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedBasemap, setSelectedBasemap] = useState<number | null>(null);
  return (
    <div className="p-4">
      <div className="mb-4">
        <Button
          small
          label="Add basemap"
          onClick={() => setAddModalOpen(true)}
        />
      </div>
      {addModalOpen && (
        <CreateBasemapModal onRequestClose={() => setAddModalOpen(false)} />
      )}
      <div className="w-full flex justify-center">
        {/* {data?.project?.basemaps?.map((b) => {
          return (
            <div
              className="border-black border-opacity-10 border shadow my-2 flex rounded cursor-pointer"
              key={b.id}
            >
              <img src={b.thumbnail} className="mr-2 w-24 h-24 rounded-l" />
              <div className="p-2">
                <h4 className="text-md">{b.name}</h4>
                {b && <p>{b.description}</p>}
              </div>
            </div>
          );
        })} */}
        {data?.project?.basemaps?.map((b) => (
          <BasemapSquareItem
            selected={selectedBasemap === b.id}
            key={b.id}
            basemap={b}
            onClick={() => {
              // if (selectedBasemap !== b.id) {
              setSelectedBasemap(b.id);
              managerContext.manager?.changeBasemap(b.url);
              // }
            }}
          />
        ))}
      </div>
    </div>
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
    <div
      className="flex flex-col float-left m-2 cursor-pointer"
      onClick={onClick}
    >
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
