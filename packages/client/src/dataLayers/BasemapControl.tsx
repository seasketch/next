import React, { useContext } from "react";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import { MapContext } from "../dataLayers/MapContextManager";
import { useTranslation, Trans } from "react-i18next";
import OptionalBasemapLayerControl from "../dataLayers/OptionalBasemapLayerControl";
import { BasemapDetailsFragment } from "../generated/graphql";

interface BasemapControlProps {
  basemaps?: BasemapDetailsFragment[];
}

export default function BasemapControl(props: BasemapControlProps) {
  const mapContext = useContext(MapContext);
  const { t } = useTranslation("basemaps");
  const selectedBasemap = mapContext.manager?.getSelectedBasemap();
  const terrainOptional =
    selectedBasemap &&
    selectedBasemap.terrainUrl &&
    selectedBasemap.terrainOptional;
  const showBasemapOptions =
    selectedBasemap &&
    (selectedBasemap.optionalBasemapLayers.length || terrainOptional);
  return (
    <>
      <div>
        <div className="p-4">
          <div className="w-full flex flex-wrap justify-center">
            {[...(props.basemaps || [])]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((b) => (
                <BasemapSquareItem
                  selected={mapContext.selectedBasemap === b.id.toString()}
                  error={mapContext.basemapError}
                  key={b.id}
                  basemap={b}
                  onClick={() => {
                    // if (selectedBasemap !== b.id) {
                    mapContext.manager?.setSelectedBasemap(b.id.toString());
                    // setSelectedBasemap(b.id);
                    // managerContext.manager?.changeBasemap(b.url);
                    // }
                  }}
                />
              ))}
          </div>
        </div>
        {showBasemapOptions && (
          <div className="bottom-0 mt-5" style={{ minHeight: "20%" }}>
            <h4 className="pb-2 font-semibold">{t("Basemap Options")}</h4>
            {terrainOptional && (
              <div className="">
                <InputBlock
                  title={<span className="font-light">{t("3d Terrain")}</span>}
                  input={
                    <Switch
                      isToggled={mapContext.terrainEnabled}
                      onClick={() => {
                        if (
                          mapContext.manager?.map &&
                          !mapContext.prefersTerrainEnabled &&
                          mapContext.manager.map.getPitch() === 0
                        ) {
                          // turning on, add some pitch
                          mapContext.manager.map.easeTo({ pitch: 75 });
                        }
                        mapContext.manager?.toggleTerrain();
                      }}
                    />
                  }
                ></InputBlock>
              </div>
            )}
            {(
              mapContext.manager!.getSelectedBasemap()!.optionalBasemapLayers ||
              []
            ).map((layer) => {
              return (
                <OptionalBasemapLayerControl key={layer.id} layer={layer} />
              );
            })}
            <button
              className="underline text-gray-500 text-sm"
              onClick={() => {
                if (mapContext.manager) {
                  mapContext.manager.clearOptionalBasemapSettings();
                  mapContext.manager.clearTerrainSettings();
                }
              }}
            >
              <Trans ns="data">reset to defaults</Trans>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function BasemapSquareItem({
  basemap,
  selected,
  onClick,
  error,
}: {
  basemap: { name: string; thumbnail: string; id: number };
  selected: boolean;
  error?: Error;
  onClick?: () => void;
}) {
  return (
    <div
      className="flex flex-col m-2 cursor-pointer select-none w-32"
      onClick={onClick}
    >
      <div
        className={`w-24 h-24 lg:w-32 lg:h-32 rounded-md mb-1 ${
          selected
            ? error
              ? "ring-4 ring-red-700 shadow-xl"
              : "ring-4 ring-blue-500 shadow-xl"
            : "shadow-md"
        }`}
        style={{
          background: `grey url(${basemap.thumbnail})`,
          backgroundSize: "cover",
        }}
      >
        &nbsp;
      </div>
      <h4
        className={`select-none w-full text-center font-medium  text-sm px-2 ${
          selected ? "text-gray-800 " : "text-gray-600"
        }`}
      >
        {basemap.name}
      </h4>
    </div>
  );
}
