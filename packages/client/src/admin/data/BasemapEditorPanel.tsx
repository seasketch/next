import { Layer } from "mapbox-gl";
import React from "react";
import { useTranslation, Trans } from "react-i18next";
import Spinner from "../../components/Spinner";
import {
  BasemapType,
  useGetBasemapQuery,
  useUpdateBasemapMutation,
  useUpdateBasemapLabelsLayerMutation,
} from "../../generated/graphql";
import { gql, useApolloClient } from "@apollo/client";

import { useMapboxStyle } from "../../useMapboxStyle";
import MutableAutosaveInput from "../MutableAutosaveInput";

export default function BasemapEditorPanel({
  basemapId,
  onRequestClose,
}: {
  basemapId: number;
  onRequestClose?: () => void;
}) {
  const { t } = useTranslation(["admin"]);
  const { data, loading, error } = useGetBasemapQuery({
    variables: {
      id: basemapId,
    },
  });
  const [
    updateLabels,
    updateLabelsState,
  ] = useUpdateBasemapLabelsLayerMutation();
  const client = useApolloClient();
  const [mutateItem, mutateItemState] = useUpdateBasemapMutation({});

  const basemap = data?.basemap;
  const mapboxStyle = useMapboxStyle(
    basemap && basemap.type === BasemapType.Mapbox ? basemap.url : undefined
  );
  let layerIds: Layer[] = [];
  if (mapboxStyle.data) {
    layerIds = [...(mapboxStyle.data.layers || [])];
    layerIds.reverse();
  }

  return (
    <div
      className="bg-white z-20 absolute bottom-0 w-128 flex flex-col"
      style={{ height: "calc(100vh - 3rem)" }}
    >
      <div className="flex-0 p-4 border-b shadow-sm bg-primary-600">
        <button
          className="bg-gray-300 bg-opacity-25 float-right rounded-full p-1 cursor-pointer focus:ring-blue-300"
          onClick={onRequestClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-5 h-5 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <h4 className="font-medium text-white">
          <Trans ns={["admin"]}>Edit Basemap</Trans>
        </h4>
      </div>
      {!basemap || mapboxStyle.loading ? (
        <Spinner />
      ) : (
        <div className="flex-1 overflow-y-scroll px-4 pb-4">
          <div className="md:max-w-sm mt-5">
            <MutableAutosaveInput
              autofocus
              mutation={mutateItem}
              mutationStatus={mutateItemState}
              propName="name"
              value={basemap.name || ""}
              label={t("Name")}
              variables={{ id: basemapId }}
            />
          </div>
          <div className="md:max-w-md mt-5">
            <label
              htmlFor="labelLayer"
              className="block text-sm font-medium leading-5 text-gray-700"
            >
              <Trans ns={["admin"]}>Labels Layer</Trans>
            </label>
            <p className="text-sm text-gray-500 py-1">
              <Trans ns={["admin"]}>
                By identifying the lowest labels layer in this basemap you will
                be able to configure layers to render below them.
              </Trans>
            </p>
            <select
              value={basemap.labelsLayerId || ""}
              id="imageFormat"
              disabled={updateLabelsState.loading}
              onChange={(e) => {
                let value: string | null = e.target.value;
                if (value === "") {
                  value = null;
                }
                client.writeFragment({
                  id: `Basemap:${basemap.id}`,
                  fragment: gql`
                    fragment NewLabelsLayer on Basemap {
                      labelsLayerId
                    }
                  `,
                  data: {
                    labelsLayerId: value,
                  },
                });
                updateLabels({
                  variables: {
                    id: basemapId,
                    layer: value,
                  },
                });
              }}
              className="rounded block w-96 pl-3 pr-4 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5 mt-1"
            >
              <option value={""}></option>
              {layerIds.map((layer) => (
                <option value={layer.id}>{layer.id}</option>
              ))}
            </select>
          </div>
          {/* <div className="mt-5">
          {item.acl?.nodeId && (
            <AccessControlListEditor nodeId={item.acl?.nodeId} />
          )}
          </div> */}
        </div>
      )}
    </div>
  );
}
