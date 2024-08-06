/* eslint-disable i18next/no-literal-string */
import Modal from "../../../components/Modal";
import { GeostatsLayer } from "@seasketch/geostats-types";
import { getAttributeValues } from "./extensions/glStyleAutocomplete";
import { CrossCircledIcon, LayersIcon } from "@radix-ui/react-icons";

export interface Geostats {
  layers: GeostatsLayer[];
  layerCount: number;
}

interface GeostatsModalProps {
  geostats: Geostats;
  onRequestClose: () => void;
  className?: string;
}

/**
 * Displays information about the layers included in the geostats prop.
 * @param props
 * @returns
 */
export default function GeostatsModal(props: GeostatsModalProps) {
  return (
    <Modal
      className={props.className}
      onRequestClose={props.onRequestClose}
      open={true}
      zeroPadding={props.geostats.layerCount === 1}
    >
      <button onClick={props.onRequestClose} className="absolute right-4 top-4">
        <CrossCircledIcon className=" w-6 h-6 text-gray-500 hover:text-gray-700" />
      </button>
      {props.geostats.layerCount === 1 ? (
        <LayerListItem layer={props.geostats.layers[0]} />
      ) : (
        <div className="px-0 py-4 pb-1">
          <h2 className="text-lg font-medium leading-6 text-gray-900">
            Layers
          </h2>
          <div className="mt-4">
            <div className="bg-white shadow border overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {props.geostats.layers.map((layer) => (
                  <LayerListItem key={layer.layer} layer={layer} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function LayerListItem({ layer }: { layer: GeostatsLayer }) {
  return (
    <div>
      <div className="px-4 py-4 sm:px-6 border-b">
        <div className="flex items-center justify-between">
          <p className="text-lg font-mediu text-gray-800 truncate flex items-center space-x-2">
            <LayersIcon />
            <span>{layer.layer}</span>
          </p>
        </div>
        <div className="mt-2 space-x-2 flex -ml-3">
          <div className="ml-2 flex-shrink-0 flex">
            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
              {layer.geometry}
            </p>
          </div>
          <div className="sm:flex">
            <p className="flex items-center text-sm text-gray-500">
              {layer.count} {layer.count === 1 ? "feature" : "features"}.
            </p>
          </div>
          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
            {layer.attributeCount}{" "}
            {layer.attributeCount === 1 ? "property" : "properties"}.
          </div>
        </div>
      </div>
      <div>
        <div className="">
          <dl>
            <div className="bg-gray-50">
              <div className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <ul className=" divide-y divide-gray-200">
                  {layer.attributes.map((attribute) => (
                    <div key={attribute.attribute}>
                      <div
                        key={attribute.attribute}
                        className="pl-3 pr-4 py-3 flex items-center justify-between text-sm clear-both"
                      >
                        <div className="w-0 flex-1 flex items-center">
                          <span className="ml-2 flex-1 w-0 truncate font-semibold text-gray-600">
                            {attribute.attribute}
                          </span>
                          {"countDistinct" in attribute && (
                            <span className="text-xs text-gray-500">
                              {attribute.countDistinct}{" "}
                              {attribute.countDistinct === 1
                                ? "value"
                                : "values"}
                            </span>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {attribute.type}
                          </span>
                        </div>
                      </div>
                      <div className="clear-both overflow-auto max-h-32 bg-white p-2 px-5 font-mono text-gray-500 ">
                        {attribute.type === "number" &&
                        getAttributeValues(attribute).length > 10
                          ? attribute.min !== undefined &&
                            attribute.max !== undefined
                            ? `${attribute.min} - ${attribute.max}`
                            : `${getAttributeValues(attribute).length} values`
                          : getAttributeValues(attribute)
                              .map((v) =>
                                /,/.test(v?.toString() || "")
                                  ? (v = `"${v}"`)
                                  : v
                              )
                              .join(", ")}
                        {attribute.type === "boolean" && `true, false`}
                        {attribute.type === "string" &&
                        getAttributeValues(attribute).length === 0 ? (
                          <span className="italic">Values unknown</span>
                        ) : (
                          ""
                        )}
                      </div>
                    </div>
                  ))}
                </ul>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
