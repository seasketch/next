import { useCallback, useContext, useState } from "react";
import {
  DataSourceTypes,
  FullAdminOverlayFragment,
  useUpdateDataSourceMutation,
  useUpdateTableOfContentsItemMutation,
} from "../../../generated/graphql";
import MutableAutosaveInput from "../../MutableAutosaveInput";
import { MapContext } from "../../../dataLayers/MapContextManager";
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

export default function LayerSettings({
  item,
}: {
  item: FullAdminOverlayFragment;
}) {
  const mapContext = useContext(MapContext);
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
      if (item?.geoprocessingReferenceId && mapContext.manager) {
        mapContext.manager.setGeoprocessingReferenceId(
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
              ? mapContext.manager?.map?.getSource(source.id.toString())
              : undefined;
            if (!sourceObj) {
              return;
            }
            // Danger Danger! Private method used here!
            // https://gis.stackexchange.com/questions/407876/how-to-update-source-property-attribution-in-mapbox-gl
            // @ts-ignore
            const controls = mapContext.manager?.map?._controls;
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
                const customSource = mapContext.manager?.getCustomGLSource(
                  source?.id
                );
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

      {item && (
        <div className="md:max-w-sm mt-5 relative">
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
