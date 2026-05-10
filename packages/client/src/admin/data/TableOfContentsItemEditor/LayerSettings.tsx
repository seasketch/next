import { useCallback, useContext, useMemo, useState } from "react";
import {
  DataSourceTypes,
  FullAdminOverlayFragment,
  ResolvableLayerCommentThreadFragment,
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
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { ClipboardCopyIcon } from "@heroicons/react/outline";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/Tooltip";
import { copyTextToClipboard } from "../../../projects/Forums/InlineAuthorDetails";
import INaturalistLayerSettingsForm from "../INaturalistLayerSettingsForm";
import Warning from "../../../components/Warning";
import AICartographerNotesSummary from "./AICartographerNotesSummary";
import LayerSettingsChangeLogList from "../../changelogs/LayerSettingsChangeLogList";
import { layerSettingsChangeLogRefetchQueries } from "../../changelogs/layerSettingsChangeLogRefetch";
import NewResolvableComment from "./NewResolvableComment";
import ResolvableComment from "./ResolvableComment";

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
  const [showNewComment, setShowNewComment] = useState(false);
  const [showResolvedComments, setShowResolvedComments] = useState(false);
  const [recentlyResolvedComment, setRecentlyResolvedComment] =
    useState<ResolvableLayerCommentThreadFragment | null>(null);

  const historicalResolvedComments = useMemo(
    () =>
      (item.resolvedCommentThreads || []).filter(
        (comment) => comment.id !== recentlyResolvedComment?.id
      ),
    [item.resolvedCommentThreads, recentlyResolvedComment?.id]
  );
  const historicalResolvedCommentCount = historicalResolvedComments.length;

  const isArcGISCustomSource =
    source?.type === DataSourceTypes.ArcgisDynamicMapserver ||
    source?.type === DataSourceTypes.ArcgisRasterTiles ||
    source?.type === DataSourceTypes.ArcgisVector;

  const changeLogRefetchQueries = useMemo(
    () => [...layerSettingsChangeLogRefetchQueries(item.id)],
    [item.id]
  );

  const [mutateItem, mutateItemState] = useUpdateTableOfContentsItemMutation({
    refetchQueries: changeLogRefetchQueries,
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
    refetchQueries: changeLogRefetchQueries,
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
          inputClassName="!pr-[4.25rem]"
          inputChildNode={
            <div className="pointer-events-none absolute inset-y-0 right-2 z-10 flex items-center">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:text-gray-700"
                    aria-label={t("Title options")}
                  >
                    <DotsHorizontalIcon className="h-4 w-4" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    className="z-50 min-w-[10rem] rounded-md border border-black/5 bg-white p-1 text-sm shadow-lg"
                  >
                    <DropdownMenu.Item
                      className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-gray-700 outline-none data-[highlighted]:bg-gray-100"
                      onSelect={() => {
                        copyReference();
                      }}
                    >
                      <ClipboardCopyIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                      {t("Copy stable id")}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          }
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
          <AccessControlListEditor
            nodeId={item.acl?.nodeId}
            refetchQueries={changeLogRefetchQueries}
          />
        )}
      </div>

      {item && source && layer && (
        <EnableDataDownload
          item={item}
          projectId={item.projectId}
          source={source}
          layer={layer}
          className="mt-5"
          changeLogRefetchTableOfContentsItemId={item.id}
        />
      )}

      {source?.type === DataSourceTypes.Inaturalist && (
        <INaturalistLayerSettingsForm
          item={item}
          changeLogRefetchTableOfContentsItemId={item.id}
        />
      )}

      {source?.aiDataAnalystNote && (
        <div className="mt-5">
          <AICartographerNotesSummary
            originalFilename={source.uploadedSourceFilename ?? undefined}
            aiDataAnalystNote={source.aiDataAnalystNote}
            geostats={source.geostats}
          />
        </div>
      )}

      <div className="mt-6">
        <h3 className="py-1 text-sm font-medium  text-gray-700">
          <Trans ns="admin:data">Unresolved Comments</Trans>
        </h3>
        <p className="text-sm text-gray-500">
          <Trans ns="admin:data">
            Comment on layers to flag issues that need to be resolved. For
            example, you can ask another project maintainer to complete a
            metadata record. These comments are only visible to admins.
          </Trans>
        </p>
        {!item.unresolvedComment && !showNewComment && (
          <div className="flex space-x-4 text-sm mt-2 font-medium">
            <button
              type="button"
              className="text-primary-500 hover:text-primary-600"
              onClick={() => {
                setRecentlyResolvedComment(null);
                setShowNewComment(true);
              }}
            >
              <Trans ns="admin:data">New Comment</Trans>
            </button>
            {historicalResolvedCommentCount > 0 ? (
              <button
                type="button"
                className="text-primary-500 hover:text-primary-600"
                onClick={() => setShowResolvedComments((prev) => !prev)}
              >
                {showResolvedComments ? (
                  <Trans ns="admin:data">Hide comment history</Trans>
                ) : (
                  t("View comment history ({{count}})", {
                    count: historicalResolvedCommentCount,
                  })
                )}
              </button>
            ) : null}
          </div>
        )}
        {item.unresolvedComment && (
          <ResolvableComment
            comment={item.unresolvedComment}
            onResolved={(comment) => {
              setRecentlyResolvedComment(comment);
              setShowResolvedComments(false);
            }}
            onReopened={() => setRecentlyResolvedComment(null)}
          />
        )}
        {!item.unresolvedComment && recentlyResolvedComment && (
          <ResolvableComment
            comment={recentlyResolvedComment}
            onReopened={() => setRecentlyResolvedComment(null)}
          />
        )}
        {showNewComment && !item.unresolvedComment && (
          <NewResolvableComment
            projectId={item.projectId}
            tableOfContentsItemId={item.id}
            onCancel={() => setShowNewComment(false)}
            onCreated={() => {
              setRecentlyResolvedComment(null);
              setShowNewComment(false);
            }}
          />
        )}
        {(item.unresolvedComment || showNewComment || recentlyResolvedComment) &&
        historicalResolvedCommentCount > 0 ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="text-sm font-medium text-primary-500 hover:text-primary-600"
              onClick={() => setShowResolvedComments((prev) => !prev)}
            >
              {showResolvedComments ? (
                <Trans ns="admin:data">Hide comment history</Trans>
              ) : (
                t("View comment history ({{count}})", {
                  count: historicalResolvedCommentCount,
                })
              )}
            </button>
          </div>
        ) : null}
        {showResolvedComments && historicalResolvedCommentCount > 0 && (
          <div className="mt-4 space-y-4">
            {historicalResolvedComments.map((comment) => (
              <ResolvableComment key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>
      <LayerSettingsChangeLogList tableOfContentsItemId={item.id} />
      {item && item.geoprocessingReferenceId && (
        <div className="md:max-w-sm mt-5 relative ">
          <div className="md:max-w-sm">
            <MutableAutosaveInput
              propName="geoprocessingReferenceId"
              mutation={mutateItem}
              mutationStatus={mutateItemState}
              value={item.geoprocessingReferenceId || ""}
              label={t("Geoprocessing Reference ID")}
              description={
                <span>
                  {t(
                    "Overlays can be assigned a stable id for reference by geoprocessing clients. You can also refer to this overlay using the following ID."
                  )}
                  <Tooltip>
                    <TooltipTrigger>
                      <button
                        onClick={copyReference}
                        className="mx-1 px-1 bg-blue-50 border-blue-300 rounded border font-mono select-text"
                      >
                        {item.stableId}
                        <ClipboardCopyIcon className="w-4 h-4 ml-1 inline -mt-0.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {referenceCopied ? (
                        <Trans ns="homepage">Copied!</Trans>
                      ) : (
                        <Trans ns="homepage">Copy Reference</Trans>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </span>
              }
              variables={{ id: item.id }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
