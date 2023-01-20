import Switch from "../components/Switch";
import InputBlock from "../components/InputBlock";
import {
  OptionalBasemapLayer,
  OptionalBasemapLayersGroupType,
  useGetOptionalBasemapLayerMetadataQuery,
} from "../generated/graphql";
import { useContext, useState } from "react";
import { MapContext } from "./MapContextManager";
import { useTranslation } from "react-i18next";
import RadioGroup from "../components/RadioGroup";
import MetadataIcon from "../components/MetadataIcon";
import MetadataModal from "./MetadataModal";

export default function OptionalBasemapLayerControl({
  layer,
  onChange,
}: {
  onChange?: (value: any) => void;
  layer: Pick<
    OptionalBasemapLayer,
    | "id"
    | "name"
    | "options"
    | "groupType"
    | "defaultVisibility"
    | "description"
    | "metadata"
  >;
}) {
  const mapContext = useContext(MapContext);
  const { t } = useTranslation(["admin"]);
  const [metadataOpen, setMetadataOpen] = useState(false);

  let options = layer.options as {
    name: string;
    description?: string;
  }[];
  if (
    layer.groupType !== OptionalBasemapLayersGroupType.None &&
    !Array.isArray(options)
  ) {
    options = [];
  }

  const metadataButton = layer.metadata ? (
    <button
      className="outline-none focus:outline-none"
      onClick={() => setMetadataOpen(true)}
    >
      <MetadataIcon className="-mt-0.5 ml-1 text-gray-700" />
    </button>
  ) : null;
  const metadataModal = metadataOpen ? (
    <BasemapMetadataModal
      id={layer.id}
      onRequestClose={() => setMetadataOpen(false)}
    />
  ) : null;

  if (layer.groupType === OptionalBasemapLayersGroupType.Select) {
    return (
      <div>
        {metadataModal}
        <InputBlock
          title={
            <span className="self-center align-middle">
              <span className="font-light">{layer.name}</span> {metadataButton}
            </span>
          }
          input={
            <select
              value={mapContext.basemapOptionalLayerStates[layer.id]}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              onChange={(e) => {
                const value = e.target.value;
                if (mapContext.manager) {
                  mapContext.manager.updateOptionalBasemapSetting(layer, value);
                }
                if (onChange) {
                  onChange(value);
                }
              }}
            >
              {options.map((opt) => (
                <option key={opt.name}>{opt.name}</option>
              ))}
            </select>
          }
        >
          {layer.description}
        </InputBlock>
      </div>
    );
  } else if (layer.groupType === OptionalBasemapLayersGroupType.Radio) {
    return (
      <div className="py-2">
        {metadataModal}
        <RadioGroup
          legend={
            <span>
              {layer.name} {metadataButton}
            </span>
          }
          value={mapContext.basemapOptionalLayerStates[layer.id]}
          onChange={(value) => {
            if (mapContext.manager) {
              mapContext.manager.updateOptionalBasemapSetting(layer, value);
            }
            if (onChange) {
              onChange(value);
            }
          }}
          items={options.map((option) => ({
            label: option.name,
            value: option.name,
            description: option.description,
          }))}
        />
      </div>
    );
  } else {
    return (
      <div>
        {metadataModal}
        <InputBlock
          title={
            <span>
              <span className="font-light">{layer.name}</span> {metadataButton}
            </span>
          }
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

function BasemapMetadataModal({
  id,
  onRequestClose,
  title,
}: {
  id: number;
  onRequestClose: () => void;
  title?: string;
}) {
  const { data, loading, error } = useGetOptionalBasemapLayerMetadataQuery({
    variables: {
      id,
    },
  });
  return (
    <MetadataModal
      title={title}
      document={data?.optionalBasemapLayer?.metadata}
      loading={loading}
      error={error}
      onRequestClose={onRequestClose}
    />
  );
}
