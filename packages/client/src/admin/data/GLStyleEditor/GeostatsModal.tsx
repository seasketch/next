/* eslint-disable i18next/no-literal-string */
import Badge from "../../../components/Badge";
import Modal from "../../../components/Modal";
import { GeostatsLayer } from "./extensions/glStyleAutocomplete";

export interface Geostats {
  layers: GeostatsLayer[];
  layerCount: number;
}

interface GeostatsModalProps {
  geostats: Geostats;
  onRequestClose: () => void;
}

/**
 * Displays information about the layers included in the geostats prop.
 * @param props
 * @returns
 */
export default function GeostatsModal(props: GeostatsModalProps) {
  return (
    <Modal onRequestClose={props.onRequestClose} open={true}>
      <div className="px-0 py-4 pb-1">
        <h2 className="text-lg font-medium leading-6 text-gray-900">Layers</h2>
        <div className="mt-4">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {props.geostats.layers.map((layer) => (
                <li key={layer.layer}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {layer.layer}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {layer.geometry}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {layer.count} features
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        {layer.attributeCount} properties
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-gray-200">
                      <dl>
                        <div className="bg-gray-50 px-4 py-4 ">
                          <div className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                              {layer.attributes.map((attribute) => (
                                <>
                                  <div
                                    key={attribute.attribute}
                                    className="pl-3 pr-4 py-3 flex items-center justify-between text-sm clear-both"
                                  >
                                    <div className="w-0 flex-1 flex items-center">
                                      <span className="ml-2 flex-1 w-0 truncate font-semibold text-gray-600">
                                        {attribute.attribute}
                                      </span>
                                    </div>
                                    <div className="ml-4 flex-shrink-0">
                                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                        {attribute.type}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="clear-both overflow-auto max-h-32 bg-white p-2 font-mono text-gray-500 ">
                                    {attribute.type === "number" &&
                                    attribute.values.length > 10
                                      ? attribute.min !== undefined &&
                                        attribute.max !== undefined
                                        ? `${attribute.min} - ${attribute.max}`
                                        : `${attribute.values.length} values`
                                      : attribute.values
                                          .map((v) =>
                                            /,/.test(v?.toString() || "")
                                              ? (v = `"${v}"`)
                                              : v
                                          )
                                          .join(", ")}
                                  </div>
                                </>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </dl>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}
