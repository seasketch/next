import React, { useEffect, useState } from "react";
import TextInput from "../../components/TextInput";
import {
  useGetLayerItemQuery,
  useUpdateTableOfContentsItemMutation,
  useUpdateDataSourceMutation,
  RenderUnderType,
  useUpdateLayerMutation,
  AccessControlListType,
  DataSourceTypes,
  DataSourceImportTypes,
  useUpdateEnableDownloadMutation,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import TableOfContentsItemAutosaveInput from "./TableOfContentsItemAutosaveInput";
import Spinner from "../../components/Spinner";
import MutableAutosaveInput from "../MutableAutosaveInput";
import RadioGroup, { MutableRadioGroup } from "../../components/RadioGroup";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import bytes from "bytes";
import Button from "../../components/Button";
import slugify from "slugify";
import Switch from "../../components/Switch";
import InteractivitySettings from "./InteractivitySettings";
import GLStyleEditor from "./GLStyleEditor";
import { gql, useApolloClient } from "@apollo/client";
import useDebounce from "../../useDebounce";
import SaveStateIndicator from "../../components/SaveStateIndicator";

interface LayerTableOfContentsItemEditorProps {
  itemId: number;
  onRequestClose?: () => void;
}

export default function LayerTableOfContentsItemEditor(
  props: LayerTableOfContentsItemEditorProps
) {
  const { t } = useTranslation(["admin"]);
  const { data, loading, error } = useGetLayerItemQuery({
    variables: {
      id: props.itemId,
    },
  });
  const [mutateItem, mutateItemState] = useUpdateTableOfContentsItemMutation();
  const [mutateSource, mutateSourceState] = useUpdateDataSourceMutation();
  const [mutateLayer, mutateLayerState] = useUpdateLayerMutation();
  const [
    updateGLStyleMutation,
    updateGLStyleMutationState,
  ] = useUpdateLayerMutation();
  const [
    updateEnableDownload,
    updateEnableDownloadState,
  ] = useUpdateEnableDownloadMutation();

  const item = data?.tableOfContentsItem;
  const [downloadEnabled, setDownloadEnabled] = useState<boolean>();

  const [style, setStyle] = useState<string>();
  const debouncedStyle = useDebounce(style, 250);

  const client = useApolloClient();
  const layer = item?.dataLayer;
  const source = layer?.dataSource;

  useEffect(() => {
    if (
      item &&
      downloadEnabled !== undefined &&
      downloadEnabled !== item?.enableDownload &&
      !updateEnableDownloadState.loading
    ) {
      updateEnableDownload({
        variables: {
          id: item.id,
          enableDownload: downloadEnabled,
        },
      });
    }
  }, [downloadEnabled, item?.enableDownload]);

  useEffect(() => {
    if (debouncedStyle) {
      updateGLStyleMutation({
        variables: {
          id: layer!.id,
          mapboxGlStyles: debouncedStyle,
        },
      });
    }
  }, [debouncedStyle]);

  return (
    <div
      className="bg-white z-20 absolute bottom-0 w-128 flex flex-col"
      style={{ height: "calc(100vh - 3rem)" }}
    >
      <div className="flex-0 p-4 border-b shadow-sm bg-primary-600">
        <button
          className="bg-gray-300 bg-opacity-25 float-right rounded-full p-1 cursor-pointer focus:ring-blue-300"
          onClick={props.onRequestClose}
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
          <Trans ns={["admin"]}>Edit Layer</Trans>
        </h4>
      </div>
      {!item && <Spinner />}
      {item && (
        <div className="flex-1 overflow-y-scroll px-4 pb-4">
          <div className="md:max-w-sm mt-5">
            <MutableAutosaveInput
              autofocus
              mutation={mutateItem}
              mutationStatus={mutateItemState}
              propName="title"
              value={item?.title || ""}
              label={t("Title")}
              variables={{ id: props.itemId }}
            />
          </div>
          <div className="md:max-w-sm mt-5">
            <MutableAutosaveInput
              propName="attribution"
              mutation={mutateSource}
              mutationStatus={mutateSourceState}
              value={source?.attribution || ""}
              label={t("Attribution")}
              description={t(
                "If set, a short attribution string will be shown at the bottom of the map."
              )}
              variables={{ id: source?.id }}
            />
          </div>
          <div className="mt-5">
            {item.acl?.nodeId && (
              <AccessControlListEditor nodeId={item.acl?.nodeId} />
            )}
          </div>
          <div className="mt-5">
            <div>
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  <Trans ns={["admin"]}>Data Source Details</Trans>
                </h3>
              </div>
              <div className="mt-5 border-t border-gray-200 border-b">
                {source?.type === DataSourceTypes.SeasketchVector && (
                  <>
                    <dl className="sm:divide-y sm:divide-gray-200">
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Source Type</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <Trans ns={["admin"]}>
                            GeoJSON data hosted on SeaSketch
                          </Trans>
                        </dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>File Size</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {bytes.format(source?.byteLength || 0)}
                        </dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Original Source</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 truncate">
                          {source?.originalSourceUrl && (
                            <a
                              target="_blank"
                              className="text-primary-600 underline"
                              href={source?.originalSourceUrl}
                            >
                              {source?.originalSourceUrl
                                .replace("https://", "")
                                .replace("http://", "")}
                            </a>
                          )}
                          {source?.importType ===
                            DataSourceImportTypes.Upload && "User Upload"}
                        </dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Actions</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-400 sm:mt-0 sm:col-span-2">
                          <button
                            className="font-semibold text-primary-600 px-2"
                            onClick={async () => {
                              const data = await fetch(
                                `https://${source.bucketId!}/${
                                  source.objectKey
                                }`
                              ).then((r) => r.json());
                              var json = JSON.stringify(data);
                              var blob = new Blob([json], {
                                type: "application/json",
                              });
                              var url = URL.createObjectURL(blob);
                              var a = document.createElement("a");
                              a.download = `${slugify(item.title)}.json`;
                              a.href = url;
                              a.textContent = `${slugify(item.title)}.json`;
                              a.click();
                            }}
                          >
                            <Trans ns={["admin"]}>Download</Trans>
                          </button>
                          |
                          <button className="font-semibold text-primary-600 px-2">
                            <Trans ns={["admin"]}>Upload</Trans>
                          </button>
                          |
                          <button className="font-semibold text-primary-600 px-2">
                            <Trans ns={["admin"]}>Update from ArcGIS</Trans>
                          </button>
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>
              {source?.type === DataSourceTypes.Geojson ||
                (source?.type === DataSourceTypes.SeasketchVector && (
                  <div className="mt-5">
                    <div className="flex">
                      <div className="flex-1 text-sm font-medium text-gray-700">
                        <Trans ns={["admin"]}>Enable data download</Trans>
                      </div>
                      <div className="flex-none">
                        <Switch
                          isToggled={
                            downloadEnabled === undefined
                              ? item.enableDownload
                              : downloadEnabled
                          }
                          onClick={() =>
                            setDownloadEnabled(
                              !(downloadEnabled === undefined
                                ? item.enableDownload
                                : downloadEnabled)
                            )
                          }
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      <Trans ns={["admin"]}>
                        If enabled, users will be able to download this dataset
                        in GeoJSON vector format using the context menu.
                      </Trans>
                    </p>
                  </div>
                ))}
            </div>
          </div>
          <div className="mt-5">
            {source && layer && (
              <InteractivitySettings
                sourceId={source.id}
                sourceLayer={layer.sourceLayer}
              />
            )}
          </div>
          <div className="mt-5">
            <MutableRadioGroup
              value={layer?.renderUnder}
              legend={t(`Basemap Integration`)}
              mutate={mutateLayer}
              mutationStatus={mutateLayerState}
              propName={"renderUnder"}
              variables={{ id: layer?.id }}
              items={[
                {
                  value: RenderUnderType.Labels,
                  label: t("Show Under Labels"),
                  description: t(
                    "Display this layer under any text labels on the basemap."
                  ),
                },
                {
                  value: RenderUnderType.Land,
                  label: t("Show Under Land"),
                  description: t(
                    "Useful when you want to present data that may not have a matching shoreline."
                  ),
                },
                {
                  value: RenderUnderType.None,
                  label: t("Cover Basemap"),
                  description: t(
                    "Render this layer above the basemap entirely."
                  ),
                },
              ]}
            />
          </div>
          {source &&
            (source.type === DataSourceTypes.Geojson ||
              source.type === DataSourceTypes.SeasketchVector ||
              source.type === DataSourceTypes.Vector) && (
              <div className="mt-5">
                <div className="flex-1 text-sm font-medium text-gray-700">
                  <Trans ns={["admin"]}>Vector Style</Trans>
                  <SaveStateIndicator {...updateGLStyleMutationState} />
                </div>
                <p className="text-sm text-gray-500">
                  <Trans ns={["admin"]}>
                    Vector layers can be styled using{" "}
                    <a
                      className="underline text-primary-500"
                      href="https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/"
                      target="_blank"
                    >
                      MapBox GL Style Layers
                    </a>
                    . Don't specify a <code>source</code> or <code>id</code>{" "}
                    property on your layers, those will be managed for you by
                    SeaSketch.
                  </Trans>
                </p>
                <GLStyleEditor
                  dataLayerId={layer?.id}
                  initialStyle={JSON.stringify(
                    JSON.parse(layer!.mapboxGlStyles!),
                    null,
                    "  "
                  )}
                  geometryType={"Polygon"}
                  onChange={(newStyle) => {
                    client.writeFragment({
                      id: `DataLayer:${layer!.id}`,
                      fragment: gql`
                        fragment NewGLStyle on DataLayer {
                          mapboxGlStyles
                        }
                      `,
                      data: {
                        mapboxGlStyles: newStyle,
                      },
                    });
                    setStyle(newStyle);
                  }}
                  arcgisServerSource={
                    source?.originalSourceUrl
                      ? source.originalSourceUrl
                      : undefined
                  }
                />
              </div>
            )}
        </div>
      )}
    </div>
  );
}
