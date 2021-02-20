import Switch from "../components/Switch";
import InputBlock from "../components/InputBlock";
import {
  Basemap,
  useGetBasemapsQuery,
  useDeleteBasemapMutation,
  GetBasemapDocument,
  useGetProjectBySlugQuery,
  useCreateOptionalLayerMutation,
  OptionalBasemapLayer,
  OptionalBasemapLayersGroupType,
} from "../generated/graphql";
import { useContext } from "react";
import { MapContext } from "./MapContextManager";
import { useTranslation, Trans } from "react-i18next";

export default function OptionalBasemapLayerControl({
  layer,
  onChange,
}: {
  onChange?: (value: any) => void;
  layer: Pick<
    OptionalBasemapLayer,
    | "id"
    | "name"
    | "groupLabel"
    | "groupType"
    | "defaultVisibility"
    | "description"
  >;
}) {
  const mapContext = useContext(MapContext);
  const { t } = useTranslation(["admin"]);

  if (layer.groupType !== OptionalBasemapLayersGroupType.None) {
    return (
      <div>
        {layer.groupLabel} - {layer.name}
      </div>
    );
  } else {
    return (
      <div>
        <InputBlock
          title={<span className="font-light">{layer.name}</span>}
          input={
            <Switch
              isToggled={mapContext.basemapOptionalLayerStates[layer.id]}
              onClick={(value) => {
                if (mapContext.manager) {
                  mapContext.manager.updateOptionalBasemapSetting(layer, value);
                }
                if (onChange) {
                  onChange(value);
                }
              }}
            />
          }
        >
          {layer.description}
        </InputBlock>
      </div>
    );
  }
}
