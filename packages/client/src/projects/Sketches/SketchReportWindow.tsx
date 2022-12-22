import { XIcon } from "@heroicons/react/outline";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Skeleton from "../../components/Skeleton";
import {
  SketchGeometryType,
  useSketchReportingDetailsQuery,
} from "../../generated/graphql";
import useAccessToken from "../../useAccessToken";
import Warning from "../../components/Warning";
import { Trans } from "react-i18next";
import Spinner from "../../components/Spinner";
import { MapContext } from "../../dataLayers/MapContextManager";

export default function SketchReportWindow({
  sketchId,
  sketchClassId,
  uiState,
  selected,
  onRequestClose,
  reportingAccessToken,
}: {
  sketchClassId: number;
  sketchId: number;
  uiState: ReportWindowUIState;
  selected: boolean;
  onRequestClose: (id: number) => void;
  reportingAccessToken?: string | null;
}) {
  const mapContext = useContext(MapContext);
  const token = useAccessToken();
  const { data, loading } = useSketchReportingDetailsQuery({
    variables: {
      id: sketchId,
      sketchClassId: sketchClassId,
    },
    fetchPolicy: "cache-first",
  });

  // eslint-disable-next-line i18next/no-literal-string
  const frameId = `${sketchId}-report-iframe`;
  const [iframeLoading, setIframeLoading] = useState(true);

  const iframe = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframe.current?.contentWindow) {
      const message = {
        type: "SeaSketchReportingVisibleLayersChangeEvent",
        visibleLayers: Object.keys(mapContext.layerStates)
          .filter((id) => mapContext.layerStates[id].visible)
          .map((id) => mapContext.layerStates[id].staticId || id),
      };
      iframe.current.contentWindow.postMessage(message, "*");
    }
  }, [mapContext.layerStates, iframe.current?.contentWindow]);

  useEffect(() => {
    const handler = async (e: MessageEvent<any>) => {
      if (
        e.data.frameId &&
        e.data.frameId === frameId &&
        e.data.type === "SeaSketchReportingInitEvent" &&
        iframe.current?.contentWindow
      ) {
        setIframeLoading(false);
        const geometryUri = process.env.REACT_APP_GRAPHQL_ENDPOINT.replace(
          "/graphql",
          // eslint-disable-next-line i18next/no-literal-string
          `/sketches/${sketchId}.geojson.json?reporting_access_token=${reportingAccessToken}`
        );
        const initMessage = {
          type: "SeaSketchReportingMessageEventType",
          client: data?.sketchClass?.geoprocessingClientName,
          geometryUri,
          visibleLayers: Object.keys(mapContext.layerStates)
            .filter((id) => mapContext.layerStates[id].visible)
            .map((id) => mapContext.layerStates[id].staticId || id),
          sketchProperties: {
            id: sketchId,
            name: data?.sketch?.name,
            createdAt: data?.sketch?.createdAt,
            updatedAt: data?.sketch?.updatedAt,
            sketchClassId: sketchClassId,
            isCollection:
              data?.sketchClass?.geometryType === SketchGeometryType.Collection,
            userAttributes: data?.sketch?.userAttributes || [],
            // TODO: populate this from map context
            ...(data?.sketchClass?.geometryType ===
            SketchGeometryType.Collection
              ? {
                  childProperties: data.sketch?.childProperties || [],
                }
              : {}),
          },
        };
        // For local testing only
        if (/localhost/.test(geometryUri)) {
          const response = await fetch(geometryUri);
          const data = await response.text();
          var dataUri = "data:application/json;base64," + btoa(data);
          initMessage.geometryUri = dataUri;
          if (initMessage.geometryUri.length >= 8000) {
            throw new Error(
              "geometryUri is >= 8k characters. When running from localhost SeaSketch uses a data-url to reference local geometry, which would be otherwise inaccessible to the remote lambda. This hack only works when the url length is short. Try drawing a shape that doesn't include much shoreline."
            );
          }
        }
        iframe.current.contentWindow.postMessage(initMessage, "*");
      } else if (
        e.data.type === "SeaSketchReportingToggleLayerVisibilityEvent" &&
        iframe.current?.contentWindow &&
        e.data.layerId
      ) {
        const { layerId, on } = e.data as { layerId: string; on: boolean };
        if (mapContext.manager) {
          if (on) {
            mapContext.manager.showLayers([layerId]);
          } else {
            mapContext.manager.hideLayers([layerId]);
          }
        }
      } else if (
        e.data.type === "SeaSketchReportingKeydownEvent" &&
        e.data.key &&
        e.data.key === "x"
      ) {
        onRequestClose(sketchId);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [
    sketchId,
    frameId,
    token,
    data?.sketchClass?.geoprocessingClientName,
    data?.sketchClass?.geometryType,
    data?.sketch?.name,
    data?.sketch?.createdAt,
    data?.sketch?.updatedAt,
    data?.sketch?.userAttributes,
    data?.sketch?.childProperties,
    sketchClassId,
    reportingAccessToken,
    mapContext?.layerStates,
    mapContext?.manager,
    onRequestClose,
  ]);

  return createPortal(
    <div
      className="flex flex-col bg-white rounded overflow-hidden w-128 shadow-lg z-10 absolute top-2 right-2"
      style={{ height: "calc(100vh - 32px)", maxHeight: 1024 }}
    >
      <div className="p-4 border-b flex items-center">
        <h1 className="flex-1 truncate text-lg">
          {loading && !data?.sketch?.name ? (
            <Skeleton className="h-5 w-36" />
          ) : (
            data?.sketch?.name
          )}
        </h1>
        <button className="" onClick={() => onRequestClose(sketchId)}>
          <XIcon className="w-5 h-5 text-black" />
        </button>
      </div>
      <div className="flex-1" style={{ backgroundColor: "#efefef" }}>
        {data?.sketchClass?.geoprocessingClientUrl && (
          <iframe
            ref={iframe}
            name={frameId}
            title={`${data.sketch?.name} Reports`}
            className={iframeLoading ? "w-0 h-0" : `w-full h-full`}
            src={data.sketchClass.geoprocessingClientUrl}
          />
        )}
        {!loading && !data?.sketchClass?.geoprocessingClientUrl ? (
          <div className="p-4">
            <Warning>
              <Trans ns="sketching">Reports not configured</Trans>
            </Warning>
          </div>
        ) : iframeLoading ? (
          <div className="p-4 flex-1 z-50 flex items-center justify-center">
            <Spinner large />
          </div>
        ) : (
          ""
        )}
      </div>
    </div>,
    document.body
  );
}

export type ReportWindowUIState = "left" | "right" | "docked";
