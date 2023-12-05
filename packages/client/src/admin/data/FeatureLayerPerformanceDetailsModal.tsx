import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { useEffect, useState } from "react";
import Spinner from "../../components/Spinner";
import { fetchFeatureLayerData } from "@seasketch/mapbox-gl-esri-sources";
import bytes from "bytes";
import { FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISFeatureLayerSource";

export default function FeatureLayerPerformanceDetailsModal({
  url,
  sourceName,
  onRequestClose,
}: {
  url: string;
  sourceName: string;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const [state, setState] = useState<{
    loading: boolean;
    pages: number;
    bytes: number;
    error?: string;
  }>({
    pages: 0,
    bytes: 0,
    loading: true,
  });

  useEffect(() => {
    const abortController = new AbortController();
    setState({
      loading: true,
      bytes: 0,
      pages: 0,
    });
    fetchFeatureLayerData(
      url,
      "*",
      (error) => {
        setState((s) => ({
          ...s,
          error: error.message,
          loading: false,
        }));
      },
      6,
      abortController,
      (bytes, loadedFeatures) => {
        const pages = Math.ceil(loadedFeatures / 2000);
        setState((s) => ({
          ...s,
          pages: s.pages + pages,
          bytes: s.bytes + bytes,
          loading: true,
        }));
      },
      false,
      2000
    ).then((fs) => {
      setState((s) => ({
        ...s,
        loading: false,
      }));
    });

    return () => {
      abortController.abort();
    };
  }, [url]);

  return (
    <Modal open onRequestClose={onRequestClose} title={sourceName}>
      <h1>{t("ArcGIS Feature Layer Performance Details")}</h1>
      <div className="max-h-64 overflow-hidden">
        <div className="bg-white">
          <div className="mx-auto my-6 max-w-md px-6 lg:px-8">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-16 text-center lg:grid-cols-2">
              <div className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base leading-7 text-gray-600">
                  {t("Download size")}
                </dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
                  {bytes(state.bytes)}
                </dd>
              </div>
              <div className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base leading-7 text-gray-600">
                  {t("Requests")}
                </dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
                  {state.pages}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        {state.error && <p className="text-red-500 text-sm">{state.error}</p>}
        {state.loading && (
          <p className="flex items-center">
            <span className="mr-2">
              {t("Analyzing data fetching performance")}
            </span>{" "}
            <Spinner />
          </p>
        )}
        {!state.loading && state.pages > 1 && (
          <p>
            <Trans ns="admin:data">
              This service requires multiple requests to server to retrieve
              vector so it would be visualized best using the <b>Tiled</b> fetch
              strategy.
            </Trans>
          </p>
        )}
        {!state.loading &&
          state.pages === 1 &&
          state.bytes > FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT && (
            <p>
              <Trans ns="admin:data">
                This service exceeds the default bytes limit of 2MB and we
                recommend using the <b>Tiled</b> fetch strategy. If you and your
                users are working in a high bandwidth environment, you may be
                able to use the <b>GeoJSON</b> fetch strategy for datasets up to
                30MB.
              </Trans>
            </p>
          )}
        {!state.loading &&
          state.pages === 1 &&
          state.bytes < FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT && (
            <p>
              <Trans ns="admin:data">
                We highly recommend using the <b>GeoJSON</b> fetch strategy for
                this service since it is a small dataset that can be retrieved
                in a single request.
              </Trans>
            </p>
          )}
      </div>
    </Modal>
  );
}
