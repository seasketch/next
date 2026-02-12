import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useContext } from "react";
import {
  DataSourceTypes,
  FullAdminOverlayFragment,
  useUpdateQueryParametersMutation,
  UpdateQueryParametersMutation,
} from "../../generated/graphql";
import { normalizeInaturalistParams } from "../../dataLayers/inaturalist";
import INaturalistLayerOptionsForm, {
  InaturalistOptionsFormValue,
} from "./INaturalistLayerOptionsForm";
import { MapManagerContext } from "../../dataLayers/MapContextManager";

export default function INaturalistLayerSettingsForm({
  item,
}: {
  item: FullAdminOverlayFragment;
}) {
  useTranslation("admin:data");
  const { manager } = useContext(MapManagerContext);
  const source = item.dataLayer?.dataSource;
  const params = normalizeInaturalistParams(
    (source?.queryParameters as any) || {}
  );
  const [formState, setFormState] = useState<InaturalistOptionsFormValue>({
    d1: params.d1,
    d2: params.d2,
    type: params.type,
    zoomCutoff: params.zoomCutoff,
    verifiable: params.verifiable,
    showCallToAction: params.showCallToAction,
    hasProject: Boolean(params.projectId),
  });

  useEffect(() => {
    setFormState({
      d1: params.d1,
      d2: params.d2,
      type: params.type,
      zoomCutoff: params.zoomCutoff,
      verifiable: params.verifiable,
      showCallToAction: params.showCallToAction,
      hasProject: Boolean(params.projectId),
    });
  }, [item.id, source?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [updateQueryParameters] = useUpdateQueryParametersMutation();

  const handleChange = (partial: Partial<InaturalistOptionsFormValue>) => {
    const next = { ...formState, ...partial };
    setFormState(next);
    updateQueryParameters({
      variables: {
        sourceId: Number(source!.id),
        queryParameters: {
          ...(source?.queryParameters as Record<string, any>),
          d1: next.d1,
          d2: next.d2,
          type: next.type,
          zoomCutoff: next.zoomCutoff,
          verifiable: next.verifiable,
          showCallToAction: next.showCallToAction,
          projectId: params.projectId,
          taxonIds: params.taxonIds,
        },
      },
      optimisticResponse: {
        __typename: "Mutation",
        updateDataSource: {
          __typename: "UpdateDataSourcePayload",
          dataSource: {
            __typename: "DataSource",
            id: Number(source?.id),
            queryParameters: {
              ...(source?.queryParameters as Record<string, any>),
              d1: next.d1,
              d2: next.d2,
              type: next.type,
              zoomCutoff: next.zoomCutoff,
              verifiable: next.verifiable,
              showCallToAction: next.showCallToAction,
              projectId: params.projectId,
              taxonIds: params.taxonIds,
            },
          },
        },
      } as UpdateQueryParametersMutation,
    });
    manager?.setDataSourceQueryParameters(Number(source?.id), {
      ...(source?.queryParameters as Record<string, any>),
      d1: next.d1,
      d2: next.d2,
      type: next.type,
      zoomCutoff: next.zoomCutoff,
      verifiable: next.verifiable,
      showCallToAction: next.showCallToAction,
      projectId: params.projectId,
      taxonIds: params.taxonIds,
    });
  };

  const readonlyLabels = useMemo(() => {
    const project =
      params.projectId === null || params.projectId === undefined
        ? null
        : params.projectId;
    const taxa =
      params.taxonIds && params.taxonIds.length ? params.taxonIds : [];
    return { project, taxa };
  }, [params.projectId, params.taxonIds]);

  if (!source || source.type !== DataSourceTypes.Inaturalist) {
    return null;
  }

  return (
    <>
      <div>
        <h3 className="text-sm font-medium leading-5 text-gray-700 mt-4 relative flex items-center space-x-1">
          <img
            src="/logos/inaturalist-bird.png"
            alt="iNaturalist"
            className="w-4 h-4 -mt-0.5"
          />
          <div>
            <Trans ns="admin:data">iNaturalist Map Service Settings</Trans>
          </div>
        </h3>
      </div>
      <div className="mt-2 space-y-4 border rounded-md p-4 bg-white">
        <div className="text-sm space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-800">
              <Trans ns="admin:data">Project</Trans>
            </span>
            {readonlyLabels.project ? (
              <a
                className="flex-1 text-right text-gray-500 truncate hover:text-primary-600"
                href={`https://www.inaturalist.org/projects/${encodeURIComponent(
                  readonlyLabels.project
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {readonlyLabels.project}
              </a>
            ) : (
              <span className="flex-1 text-right text-gray-500 truncate">
                <Trans ns="admin:data">Not set</Trans>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-800">
              <Trans ns="admin:data">Taxa</Trans>
            </span>
            {readonlyLabels.taxa.length > 0 ? (
              <div className="flex-1 text-right text-gray-500 truncate space-x-1">
                {readonlyLabels.taxa.map((id, idx) => (
                  <a
                    key={id}
                    className={`hover:text-primary-600 ${
                      idx > 0 ? "ml-1" : ""
                    }`}
                    href={`https://www.inaturalist.org/taxa/${encodeURIComponent(
                      id
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {id}
                    {idx < readonlyLabels.taxa.length - 1 ? "," : ""}
                  </a>
                ))}
              </div>
            ) : (
              <span className="flex-1 text-right text-gray-500 truncate">
                <Trans ns="admin:data">Not set</Trans>
              </span>
            )}
          </div>
        </div>

        <INaturalistLayerOptionsForm
          value={formState}
          onChange={handleChange}
        />
      </div>
    </>
  );
}
