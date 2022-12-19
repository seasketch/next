import { XIcon } from "@heroicons/react/outline";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Skeleton from "../../components/Skeleton";
import {
  SketchGeometryType,
  useSketchReportingDetailsQuery,
} from "../../generated/graphql";
import useAccessToken from "../../useAccessToken";
import { collectText, collectQuestion } from "../../admin/surveys/collectText";
import slugify from "slugify";
import Warning from "../../components/Warning";
import { Trans } from "react-i18next";

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

  const iframe = useRef<HTMLIFrameElement>(null);

  const userAttributes = useMemo(() => {
    const properties = data?.sketch?.properties || {};
    const attributes: {
      exportId: string;
      label: string;
      fieldType: string;
      value: any;
    }[] = [];
    for (const element of data?.sketchClass?.form?.formElements || []) {
      if (element.isInput) {
        attributes.push({
          fieldType: element.typeId,
          exportId: createExportId(
            element.id,
            element.body,
            element.exportId || undefined
          ),
          value: properties[element.id],
          label:
            element.typeId === "FeatureName"
              ? "Name"
              : collectQuestion(element.body) || "Unknown",
        });
      }
    }
    return attributes;
  }, [data?.sketchClass?.form?.formElements, data?.sketch?.properties]);

  useEffect(() => {
    const handler = async (e: MessageEvent<any>) => {
      if (
        e.data.frameId &&
        e.data.frameId === frameId &&
        e.data.type === "SeaSketchReportingInitEvent" &&
        iframe.current?.contentWindow
      ) {
        const geometryUri = process.env.REACT_APP_GRAPHQL_ENDPOINT.replace(
          "/graphql",
          // eslint-disable-next-line i18next/no-literal-string
          `/sketches/${sketchId}.geojson.json?reporting_access_token=${reportingAccessToken}`
        );
        const initMessage = {
          type: "SeaSketchReportingMessageEventType",
          client: data?.sketchClass?.geoprocessingClientName,
          geometryUri,
          sketchProperties: {
            id: sketchId,
            name: data?.sketch?.name,
            createdAt: data?.sketch?.createdAt,
            updatedAt: data?.sketch?.updatedAt,
            sketchClassId: sketchClassId,
            isCollection:
              data?.sketchClass?.geometryType === SketchGeometryType.Collection,
            userAttributes,
            // TODO: populate this from map context
            visibleLayers: [],
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
    sketchClassId,
    userAttributes,
    reportingAccessToken,
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
            className="w-full h-full"
            src={data.sketchClass.geoprocessingClientUrl}
          />
        )}
        {!data?.sketchClass?.geoprocessingClientUrl && (
          <div className="p-4">
            <Warning>
              <Trans ns="sketching">Reports not configured</Trans>
            </Warning>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export type ReportWindowUIState = "left" | "right" | "docked";

/**
 * Returns a useable stable identifier for the FormElement if a exportId is not
 * specified. Will attempt to extract text from the begining of
 * FormElement.body, if available. Otherwise returns form_element_{id}.
 *
 * @param id FormElement ID
 * @param body ProseMirror document from which text can be extracted to create an exportId
 * @param exportId The admin-defined exportId, if defined
 * @returns
 */
export function createExportId(id: number, body: any, exportId?: string) {
  if (exportId) {
    return exportId;
  } else if (!body) {
    // eslint-disable-next-line i18next/no-literal-string
    return `form_element_${id}`;
  } else {
    const text = collectText(body);
    if (text.length < 5) {
      // eslint-disable-next-line i18next/no-literal-string
      return `form_element_${id}`;
    } else {
      return slugify(text.toLowerCase(), "_").slice(0, 32);
    }
  }
}
