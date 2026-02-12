// @ts-nocheck
import { XIcon } from "@heroicons/react/outline";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "../../components/Skeleton";
import {
  SketchGeometryType,
  useLegacyReportContextQuery,
} from "../../generated/graphql";
import useAccessToken from "../../useAccessToken";
import Warning from "../../components/Warning";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import { LayerTreeContext, MapManagerContext } from "../../dataLayers/MapContextManager";
import languages from "../../lang/supported";
import { getSelectedLanguage } from "../../surveys/LanguageSelector";
import { evaluateVisibilityRules } from "./SketchForm";

export default function LegacySketchReportWindow({
  sketchId,
  sketchClassId,
  uiState,
  selected,
  onRequestClose,
  reportingAccessToken,
  onClick,
}: {
  sketchClassId: number;
  sketchId: number;
  uiState: ReportWindowUIState;
  selected: boolean;
  onRequestClose: (id: number) => void;
  reportingAccessToken?: string | null;
  onClick?: (metaKey: boolean, id: number) => void;
}) {
  const mapContext = useContext(LayerTreeContext);
  const { manager } = useContext(MapManagerContext);
  const token = useAccessToken();
  const { data, loading, error } = useLegacyReportContextQuery({
    variables: {
      sketchId: sketchId,
    },
    fetchPolicy: "cache-first",
  });

  // eslint-disable-next-line i18next/no-literal-string
  const frameId = `${sketchId}-report-iframe`;
  const [iframeLoading, setIframeLoading] = useState(true);
  const filteredLanguages = useMemo(
    () =>
      languages.filter(
        (f) =>
          !data?.sketch?.sketchClass?.project?.supportedLanguages ||
          data?.sketch?.sketchClass?.project?.supportedLanguages.find(
            (o) => o === f.code
          ) ||
          f.code === "EN"
      ),
    [data?.sketch?.sketchClass?.project?.supportedLanguages, languages]
  );

  const { i18n } = useTranslation();
  const lang = getSelectedLanguage(i18n, filteredLanguages);

  const iframe = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframe.current?.contentWindow) {
      const message = {
        type: "SeaSketchReportingVisibleLayersChangeEvent",
        visibleLayers: manager?.getVisibleLayerReferenceIds() || [],
      };
      iframe.current.contentWindow.postMessage(message, "*");
    }
  }, [
    mapContext.layerStatesByTocStaticId,
    iframe.current?.contentWindow,
    manager,
  ]);

  useEffect(() => {
    if (iframe.current?.contentWindow) {
      iframe.current.contentWindow.postMessage(
        {
          type: "SeaSketchReportingLanguageChangeEvent",
          language: lang?.selectedLang?.code || "en",
        },
        "*"
      );
    }
  }, [lang?.selectedLang?.code]);

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

        // Find hidden elements from visibility rules
        const hiddenElements = evaluateVisibilityRules(
          Object.keys(data?.sketch?.properties || {}).reduce((acc, key) => {
            acc[key] = {
              value: data?.sketch?.properties[key],
            };
            return acc;
          }, {} as { [key: string]: { value: any } }),
          data?.sketch?.sketchClass?.form?.logicRules || []
        );

        // Removing user attributes hidden by logic rules
        const userAttributes = (data?.sketch?.userAttributes || []).filter(
          (a: any) => !hiddenElements.includes(a.formElementId)
        );

        const initMessage = {
          type: "SeaSketchReportingMessageEventType",
          client: data?.sketch?.sketchClass?.geoprocessingClientName,
          language: lang?.selectedLang?.code || "en",
          geometryUri,
          visibleLayers:
            manager?.getVisibleLayerReferenceIds() || [],
          sketchProperties: {
            id: sketchId,
            name: data?.sketch?.name,
            createdAt: data?.sketch?.createdAt,
            updatedAt: data?.sketch?.updatedAt,
            sketchClassId: sketchClassId,
            isCollection:
              data?.sketch?.sketchClass?.geometryType ===
              SketchGeometryType.Collection,
            userAttributes: userAttributes,
            // TODO: populate this from map context
            ...(data?.sketch?.sketchClass?.geometryType ===
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
        if (manager) {
          if (on) {
            manager.showTocItems([layerId]);
          } else {
            manager.hideTocItems([layerId]);
          }
        }
      } else if (
        e.data.type === "SeaSketchReportingKeydownEvent" &&
        e.data.key &&
        e.data.key === "x" &&
        iframe.current?.contentWindow === e.source
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
    data?.sketch?.sketchClass?.geoprocessingClientName,
    data?.sketch?.sketchClass?.geometryType,
    data?.sketch?.name,
    data?.sketch?.createdAt,
    data?.sketch?.updatedAt,
    data?.sketch?.userAttributes,
    data?.sketch?.childProperties,
    sketchClassId,
    reportingAccessToken,
    mapContext?.layerStatesByTocStaticId,
    manager,
    onRequestClose,
    lang?.selectedLang?.code,
  ]);

  // store close button ref
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (closeButton.current) {
        closeButton.current.focus();
      }
    }, 10);
  }, [closeButton]);

  return (
    <div
      className="flex-none flex flex-col bg-white rounded overflow-hidden w-128 shadow-lg pointer-events-auto"
      style={{ height: "calc(100vh - 32px)", maxHeight: 1024 }}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          e.preventDefault();
          e.nativeEvent.stopImmediatePropagation();
          e.nativeEvent.preventDefault();
          onClick(e.metaKey, sketchId);
          return false;
        }
      }}
    >
      <div className="p-4 border-b flex items-center">
        <h1 className="flex-1 truncate text-lg">
          {loading && !data?.sketch?.name ? (
            <Skeleton className="h-5 w-36" />
          ) : (
            data?.sketch?.name
          )}
        </h1>
        <button
          ref={closeButton}
          autoFocus
          className="hover:bg-gray-100 rounded-full p-2 -mr-2"
          onClick={() => onRequestClose(sketchId)}
        >
          <XIcon className="w-5 h-5 text-black" />
        </button>
      </div>
      <div className="flex-1" style={{ backgroundColor: "#efefef" }}>
        {data?.sketch?.sketchClass?.geoprocessingClientUrl && (
          <iframe
            ref={iframe}
            name={frameId}
            title={`${data.sketch?.name} Reports`}
            className={iframeLoading ? "w-0 h-0" : `w-full h-full`}
            src={data.sketch.sketchClass.geoprocessingClientUrl}
          />
        )}
        {!loading && !data?.sketch?.sketchClass?.geoprocessingClientUrl ? (
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
    </div>
  );
}

export type ReportWindowUIState = "left" | "right" | "docked";
