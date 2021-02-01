import bytes from "bytes";
import React from "react";
import Button from "../../../components/Button";
import DownloadIcon from "../../../components/DownloadIcon";
import LinkIcon from "../../../components/LinkIcon";
import Modal from "../../../components/Modal";
import ProgressBar from "../../../components/ProgressBar";
import Spinner from "../../../components/Spinner";
import Warning from "../../../components/Warning";
import useProjectId from "../../../useProjectId";
import {
  ArcGISServiceSettings,
  LayerInfo,
  MapServerCatalogInfo,
  useImportArcGISService,
  useVectorSublayerStatus,
  VectorSublayerSettings,
} from "./arcgis";
import QuotaBar from "./QuotaBar";
import { useHistory, useParams } from "react-router-dom";

interface ImportVectorLayersProps {
  layers?: LayerInfo[];
  settings?: ArcGISServiceSettings;
  mapServerInfo: MapServerCatalogInfo;
  open: boolean;
  serviceRoot?: string;
  onRequestClose: () => void;
}

export default function ImportVectorLayersModal(
  props: ImportVectorLayersProps
) {
  const { layers, settings, open, onRequestClose } = props;
  const { layerStatus, abortController } = useVectorSublayerStatus(
    open,
    layers,
    settings?.vectorSublayerSettings
  );
  const history = useHistory();

  const { importService, ...importServiceState } = useImportArcGISService(
    props.serviceRoot
  );
  const { slug } = useParams<{ slug: string }>();
  const projectId = useProjectId();

  if (!layers) {
    return null;
  }
  let totalBytes = 0;
  for (const layer of layers) {
    const layerSettings = settings?.vectorSublayerSettings.find(
      (l) => l.sublayer === layer.id
    );
    if (!layerSettings || layerSettings.importType === "geojson") {
      totalBytes +=
        layerStatus[layer.generatedId]?.data?.geoJsonBytes ||
        layerStatus[layer.generatedId]?.loadedBytes ||
        0;
    }
  }

  const quota = 1_240_000_000;
  const remainingQuota = 920_000_000;

  const remaining = layers.filter(
    (layer) =>
      layer.type !== "Group Layer" &&
      !(
        layerStatus[layer.generatedId] &&
        layerStatus[layer.generatedId].loading !== true
      )
  ).length;
  const pendingIndex = layers.length - remaining;

  const numErrors = Object.values(layerStatus).filter((s) => {
    if (s.error || s.data?.warnings.find((w) => w.level === "error")) {
      return true;
    } else {
      return false;
    }
  }).length;

  const onImport = async () => {
    const result = await importService(
      layers!.filter((l) => l.type !== "Raster Layer"),
      props.mapServerInfo,
      projectId!,
      props.settings!,
      "vector",
      layers!.reduce((total, layer) => {
        if (layer.type !== "Group Layer" && layer.type !== "Raster Layer") {
          const layerSettings = settings?.vectorSublayerSettings.find(
            (s) => s.sublayer === layer.id
          );
          if (layerSettings && layerSettings.importType === "dynamic") {
            // not uploading
          } else {
            total += layerStatus[layer.generatedId].data?.geoJsonBytes || 0;
          }
        }
        return total;
      }, 0)
    );
    if (!importServiceState.error) {
      history.push(`/${slug}/admin/data`);
    }
  };

  return (
    <Modal
      open={open}
      onRequestClose={() => {
        if (importServiceState.inProgress) {
          if (
            window.confirm(
              "Are you sure you want to cancel importing this service? Proceeding may leave partially imported service items in the layer list."
            )
          ) {
            importServiceState.abortController?.abort();
            onRequestClose();
          }
        } else {
          onRequestClose();
        }
      }}
      title="Import Vector Layers"
      footer={
        <div className="p-6 bg-gray-100 border-t">
          {remaining > 0 ? (
            <>
              Analyzing layer {pendingIndex + 1} of {layers.length}{" "}
              <span className="text-gray-500">
                ({bytes(totalBytes, { decimalPlaces: 2 })})
              </span>
              <div className="flex">
                <p className="text-sm py-2">
                  SeaSketch is preparing for import by reviewing your settings
                  and the file sizes of the selected layers.
                </p>
                <Button
                  className="mx-2"
                  onClick={onRequestClose}
                  label="Cancel"
                />
              </div>
            </>
          ) : numErrors > 0 ? (
            <div>
              <p className="my-2 mb-3">
                There were errors found when analyzing this service. Either
                exclude layers with errors from the import or adjust their
                settings to fix the error before proceeding.
              </p>
              <Button onClick={onRequestClose} label="Go Back" />
            </div>
          ) : importServiceState.inProgress ? (
            <div>
              <div>
                <h3>Importing Service</h3>
                <ProgressBar progress={importServiceState.progress!} />
                <div className="mb-2 text-sm">
                  {importServiceState.statusMessage}
                </div>
              </div>
              {/* <Button
                onClick={onRequestClose}
                label="Cancel"
                className="mr-2"
              /> */}
            </div>
          ) : importServiceState.error ? (
            <div>
              <h3>Importing Service</h3>
              <div className="mb-2 mt-4 text-red-900">
                <h4>{importServiceState.error.name}</h4>
                {importServiceState.error.message}
              </div>
              <Button
                onClick={onRequestClose}
                label="Cancel"
                className="mr-2"
              />
              <Button label="Try Again" primary onClick={onImport} />
            </div>
          ) : (
            <div>
              {totalBytes > 0 && (
                <>
                  {" "}
                  Importing this service will consume{" "}
                  {bytes(totalBytes, { decimalPlaces: 0 })} of your{" "}
                  {bytes(quota, { decimalPlaces: 0 })} quota.
                  <QuotaBar
                    total={quota}
                    remaining={remainingQuota}
                    additional={totalBytes}
                  />
                </>
              )}
              <p className="my-2 mb-3">
                Review any warnings or errors above before importing. Once the
                import process begins, be sure not to close the browser window
                or let your computer go to sleep. Otherwise the import will
                fail.
              </p>
              <Button
                onClick={onRequestClose}
                label="Cancel"
                className="mr-2"
              />
              <Button label="Import Layers" primary onClick={onImport} />
            </div>
          )}
        </div>
      }
      className="lg:w-160"
    >
      <div
        className="-mt-6 -mb-6"
        style={{
          width: "calc(100% + 3rem)",
          marginLeft: "-1.5rem",
          maxHeight: "calc(100vh - 450px)",
        }}
      >
        {layers.map((layer, index) => {
          const isFolder = layer.type === "Group Layer";
          if (isFolder) {
            return null;
          }
          const status = layerStatus[layer.generatedId];
          const layerSettings = settings?.vectorSublayerSettings.find(
            (s) => s.sublayer === layer.id
          );
          return (
            <div key={layer.id}>
              <div
                key={layer.generatedId}
                className={`flex w-full ${
                  index % 2 !== 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                <div className="flex-1 px-6 py-4 whitespace-nowrap text-sm leading-5 font-medium text-gray-900 truncate">
                  <span className="truncate">{layer.name}</span>
                </div>
                <div className="w-20 px-6 py-4 whitespace-nowrap text-sm leading-5 text-right pr-0 text-gray-500">
                  {status?.loading &&
                    status.loadedFeatures &&
                    status.estimatedFeatures && (
                      <span>
                        {Math.round(
                          (status.loadedFeatures / status.estimatedFeatures) *
                            100
                        )}
                        %
                      </span>
                    )}
                </div>

                <div className="w-32 text-right px-6 py-4 whitespace-nowrap text-sm leading-5 text-gray-500 align-middle flex justify-end">
                  {status ? (
                    status.loading ? (
                      <>
                        <span className="-mr-2">
                          {status.loadedBytes &&
                            bytes(status.loadedBytes || 0, {
                              decimalPlaces: 0,
                            })}
                        </span>
                        <Spinner />
                      </>
                    ) : status.error ? (
                      ""
                    ) : (
                      <>
                        <span className="mr-1">
                          {bytes(status.data?.geoJsonBytes || 0, {
                            decimalPlaces: 0,
                          })}
                        </span>
                        {layerSettings?.importType === "dynamic" ? (
                          <LinkIcon className="text-gray-500" />
                        ) : (
                          <DownloadIcon className="text-gray-500" />
                        )}
                      </>
                    )
                  ) : (
                    ""
                  )}
                </div>
              </div>

              {status &&
              (status.error ||
                (status.data &&
                  status.data.warnings &&
                  status.data.warnings.length)) ? (
                <div
                  className={`p-6 pt-0 flex flex-col w-full ${
                    index % 2 !== 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  {status.data?.warnings
                    .filter((w) =>
                      layerSettings?.importType === "dynamic"
                        ? w.type === "arcgis"
                        : w.type === "geojson"
                    )
                    .map((warning, i) => (
                      <Warning
                        key={i}
                        className="sm:mt-0 mt-0"
                        level={warning.level}
                      >
                        {warning.message}
                      </Warning>
                    ))}
                  {status.error ? (
                    <Warning className="sm:mt-0 mt-0" level="error">
                      An error occured when retrieving this dataset and it
                      cannot be imported. {status.error.message}
                    </Warning>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
