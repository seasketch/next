/* eslint-disable i18next/no-literal-string */
import { useCallback, useContext, useMemo, useState } from "react";
import {
  DataSourceTypes,
  FullAdminOverlayFragment,
  useUpdateDataSourceMutation,
  useUpdateTableOfContentsItemMutation,
} from "../../../generated/graphql";
import MutableAutosaveInput from "../../MutableAutosaveInput";
import { MapManagerContext } from "../../../dataLayers/MapContextManager";
import TranslatedPropControl from "../../../components/TranslatedPropControl";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import AccessControlListEditor from "../../../components/AccessControlListEditor";
import EnableDataDownload from "../EnableDataDownload";
import { ClipboardCopyIcon } from "@heroicons/react/outline";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/Tooltip";
import { copyTextToClipboard } from "../../../projects/Forums/InlineAuthorDetails";
import INaturalistLayerSettingsForm from "../INaturalistLayerSettingsForm";
import {
  type AuditEvent,
  type AuditEventType,
  MOCK_PROFILES,
  daysAgo,
  EventTimeline,
  CompareButton,
} from "../AuditEventTimeline";
import Warning from "../../../components/Warning";

export default function LayerSettings({
  item,
}: {
  item: FullAdminOverlayFragment;
}) {
  const { manager } = useContext(MapManagerContext);
  const { t } = useTranslation("admin:data");
  const layer = item.dataLayer;
  const source = layer!.dataSource;
  const [referenceCopied, setReferenceCopied] = useState(false);

  const isArcGISCustomSource =
    source?.type === DataSourceTypes.ArcgisDynamicMapserver ||
    source?.type === DataSourceTypes.ArcgisRasterTiles ||
    source?.type === DataSourceTypes.ArcgisVector;

  const [mutateItem, mutateItemState] = useUpdateTableOfContentsItemMutation({
    onCompleted: (data) => {
      const item = data.updateTableOfContentsItem?.tableOfContentsItem;
      if (item?.geoprocessingReferenceId && manager) {
        manager.setGeoprocessingReferenceId(
          item.geoprocessingReferenceId,
          item.stableId
        );
      }
    },
  });

  const copyReference = useCallback(() => {
    if (item) {
      copyTextToClipboard(item.stableId);
      setReferenceCopied(true);
      setTimeout(() => {
        setReferenceCopied(false);
      }, 2000);
    }
  }, [setReferenceCopied, item]);

  const onError = useGlobalErrorHandler();
  const [mutateSource, mutateSourceState] = useUpdateDataSourceMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateDataSource: {
          __typename: "UpdateDataSourcePayload",
          dataSource: {
            __typename: "DataSource",
            attribution: data.attribution,
            ...data,
          },
        },
      };
    },
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="md:max-w-sm mt-5 relative">
        <MutableAutosaveInput
          // autofocus
          mutation={mutateItem}
          mutationStatus={mutateItemState}
          propName="title"
          value={item?.title || ""}
          label={t("Title")}
          variables={{ id: item.id }}
        />
        <TranslatedPropControl
          id={item.id}
          label={t("Overlay Title")}
          propName="title"
          typeName="TableOfContentsItem"
          defaultValue={item.title}
          className="p-0.5 absolute -right-9 top-8 -mt-0.5 border rounded hover:shadow-sm"
        />
      </div>
      <div className="md:max-w-sm mt-5 relative">
        <MutableAutosaveInput
          propName="attribution"
          mutation={mutateSource}
          mutationStatus={mutateSourceState}
          value={source?.attribution || ""}
          label={t("Attribution")}
          onChange={async (value) => {
            const sourceObj = source?.id
              ? manager?.map?.getSource(source.id.toString())
              : undefined;
            if (!sourceObj) {
              return;
            }
            // Danger Danger! Private method used here!
            // https://gis.stackexchange.com/questions/407876/how-to-update-source-property-attribution-in-mapbox-gl
            // @ts-ignore
            const controls = manager?.map?._controls;
            let updateAttribution: undefined | Function;
            if (controls && Array.isArray(controls)) {
              for (const control of controls) {
                if (
                  "_updateAttributions" in control &&
                  typeof control._updateAttributions === "function"
                ) {
                  updateAttribution = (attr: string) => {
                    // @ts-ignore
                    sourceObj.attribution = attr;
                    // @ts-ignore
                    control._updateAttributions();
                  };
                }
              }
            }
            if (updateAttribution) {
              if (value?.trim().length === 0 && source?.id) {
                const customSource = manager?.getCustomGLSource(source?.id);
                if (!customSource) {
                  updateAttribution("");
                } else {
                  const metadata = await customSource.getComputedMetadata();
                  updateAttribution(metadata.attribution || " ");
                }
              } else {
                updateAttribution(value);
              }
            }
          }}
          description={
            isArcGISCustomSource
              ? t(
                  "Leave blank to display attribution dynamically from ArcGIS service, or provide attribution to override the service metadata."
                )
              : t(
                  "If set, a short attribution string will be shown at the bottom of the map."
                )
          }
          variables={{ id: source?.id }}
        />

        {/* TODO: Disabled for now because working it into MapContextManager is tricky */}
        {/* {source && (
      <TranslatedPropControl
        id={source.id}
        label={t("Overlay Attribution")}
        propName="attribution"
        typeName="DataSource"
        defaultValue={source.attribution}
        className="p-0.5 absolute -right-9 top-8 -mt-0.5 border rounded hover:shadow-sm"
      />
    )} */}
      </div>
      {item.relatedReportCardDetails &&
        item.relatedReportCardDetails.length > 0 && (
          <>
            <Warning level="warning" className="mt-5">
              <p>
                <Trans ns="admin:data">
                  This layer is referenced in analytical reports. Making changes
                  to the data or cartography may impact report outputs.
                </Trans>
              </p>
              <ul className="mt-1 text-sm text-gray-500 space-y-0.5">
                {item.relatedReportCardDetails
                  .filter((detail) => detail?.isDraft)
                  .map((detail) => (
                    <li key={detail?.sketchClassId}>
                      {detail?.sketchClass?.name} - {detail?.title}
                    </li>
                  ))}
              </ul>
            </Warning>
          </>
        )}
      <div className="mt-5">
        {item.acl?.nodeId && (
          <AccessControlListEditor nodeId={item.acl?.nodeId} />
        )}
      </div>

      {item && source && layer && (
        <EnableDataDownload
          item={item}
          projectId={item.projectId}
          source={source}
          layer={layer}
          className="mt-5"
        />
      )}

      {source?.type === DataSourceTypes.Inaturalist && (
        <INaturalistLayerSettingsForm item={item} />
      )}

      <LayerHistory title={item.title || "Untitled Layer"} />
    </div>
  );
}

function titleToFilename(title: string): string {
  return (
    title
      .replace(/\s+/g, "_")
      .replace(/[()]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "") + ".zip"
  );
}

function titleToOldTitle(title: string): string {
  return title
    .replace(/\s+/g, "_")
    .replace(/[()]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function LayerHistory({ title }: { title: string }) {
  const oldTitle = titleToOldTitle(title);
  const filename = titleToFilename(title);

  const events: AuditEvent[] = useMemo(
    () => [
      {
        id: "1",
        type: "title_change" as AuditEventType,
        actor: MOCK_PROFILES.chad,
        date: daysAgo(3),
        description: (
          <span>
            changed <span className="font-medium text-gray-900">title</span>{" "}
            from{" "}
            <code className="text-sm bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded line-through">
              {oldTitle}
            </code>{" "}
            to{" "}
            <code className="text-sm bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">
              {title}
            </code>
          </span>
        ),
      },
      {
        id: "2",
        type: "acl_change" as AuditEventType,
        actor: MOCK_PROFILES.chad,
        date: daysAgo(3),
        description: (
          <span>
            changed <span className="font-medium text-gray-900">access</span>{" "}
            from <span className="font-medium">public</span> to{" "}
            <Tooltip>
              <TooltipTrigger>
                <span className="font-medium text-blue-600 underline decoration-dotted cursor-help">
                  group-only
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs max-w-xs">
                  <p className="font-medium mb-1">Restricted to:</p>
                  <ul className="list-disc ml-3 space-y-0.5">
                    <li>Project Admins</li>
                    <li>Marine Biologists Working Group</li>
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          </span>
        ),
      },
      {
        id: "3",
        type: "cartography_update" as AuditEventType,
        actor: MOCK_PROFILES.nick,
        date: daysAgo(8),
        description: (
          <span>
            updated{" "}
            <span className="font-medium text-gray-900">cartography</span>{" "}
            <CompareButton />
          </span>
        ),
      },
      {
        id: "4",
        type: "publish" as AuditEventType,
        actor: MOCK_PROFILES.nick,
        date: daysAgo(12),
        description: (
          <span>
            published <span className="font-medium">data layers list</span>
          </span>
        ),
      },
      {
        id: "5",
        type: "metadata_update" as AuditEventType,
        actor: MOCK_PROFILES.sammi,
        date: daysAgo(18),
        description: (
          <span>
            updated <span className="font-medium text-gray-900">metadata</span>{" "}
            <CompareButton />
          </span>
        ),
      },
      {
        id: "6",
        type: "layer_created" as AuditEventType,
        actor: MOCK_PROFILES.sammi,
        date: daysAgo(24),
        description: (
          <span>
            uploaded{" "}
            <Tooltip>
              <TooltipTrigger>
                <code className="text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded cursor-help">
                  {filename}
                </code>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">12.4 MB &middot; ESRI Shapefile</div>
              </TooltipContent>
            </Tooltip>
          </span>
        ),
      },
    ],
    [title, oldTitle, filename]
  );

  return (
    <div className="mt-8 mb-4">
      <div className="border-t border-gray-200 pt-5 mb-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          History
        </h3>
      </div>
      <EventTimeline events={events} />
    </div>
  );
}
