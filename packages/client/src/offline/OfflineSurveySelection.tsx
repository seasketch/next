import { ExternalLinkIcon } from "@heroicons/react/outline";
import { CheckCircleIcon, CogIcon } from "@heroicons/react/solid";
import bytes from "bytes";
import { useContext, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import Button from "../components/Button";
import { Card, Header } from "../components/CenteredCardListLayout";
import DropdownButton from "../components/DropdownButton";
import Spinner from "../components/Spinner";
import Warning from "../components/Warning";
import {
  BasemapDetailsFragment,
  useOfflineSurveysQuery,
} from "../generated/graphql";
import { CacheProgress } from "./CacheStatus";
import { ClientCacheManagerContext } from "./ClientCacheManager";
import DownloadBasemapModal from "./DownloadBasemapModal";
import useBasemapsBySurvey, {
  BasemapDetailsAndClientCacheStatus,
} from "./useBasemapsBySurvey";

export default function OfflineSurveySelection() {
  const slug = window.location.pathname.split("/")[1];
  const context = useContext(ClientCacheManagerContext);
  const { data } = useOfflineSurveysQuery({
    variables: { slug },
  });
  const { t } = useTranslation("offline");
  const { surveyBasemaps } = useBasemapsBySurvey(
    context?.cacheSizes?.selectedSurveyIds,
    true
  );
  const [downloadBasemapModalOpen, setDownloadBasemapModalOpen] =
    useState<null | Pick<BasemapDetailsFragment, "id" | "url" | "name">>(null);

  const surveys = useMemo(() => {
    if (data?.projectBySlug?.surveys) {
      return data.projectBySlug.surveys.map((s) => ({
        id: s.id,
        name: s.name,
      }));
    } else {
      return [];
    }
  }, [data?.projectBySlug?.surveys]);

  useEffect(() => {
    if (context) {
      context.updateCacheSizes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <Header>
        <Trans ns="offline">Offline Surveys</Trans>
      </Header>
      <p className="text-gray-800 text-sm">
        <Trans ns="offline">
          SeaSketch can cache selected surveys for use offline in the field. You
          will need to make sure that Data Caching is set to "Improved
          Performance" or higher to enable this functionality.
        </Trans>
      </p>
      {context &&
      context.cacheSizes?.offlineSurveys.queries &&
      context.level.id !== "improved" &&
      context.level.id !== "max" ? (
        <Warning>
          <Trans ns="offline">
            Data Caching setting must be set higher to enable offline support.
          </Trans>
        </Warning>
      ) : null}
      {data && context?.cacheSizes ? (
        <div className="inline-block w-full py-2 align-middle">
          <div className="mb-4">
            {surveys.map((survey) => (
              <div key={survey.id} className="w-full flex">
                <div className="text-gray-900 text-center p-2 mr-2 items-center">
                  <input
                    checked={
                      context.cacheSizes?.selectedSurveyIds.indexOf(
                        survey.id
                      ) !== -1
                    }
                    className="cursor-pointer"
                    type="checkbox"
                    id={`survey-${survey.id}`}
                    onChange={async (e) => {
                      e.stopPropagation();
                      await context.toggleSurveyOfflineSupport(survey.id, slug);
                      context.populateOfflineSurveyAssets(false);
                    }}
                  />
                </div>
                <div className="truncate flex-1 text-sm text-gray-500 items-center flex">
                  <label htmlFor={`survey-${survey.id}`}>{survey.name}</label>
                </div>
                <div className="flex items-center">
                  <Link target="_blank" to={`/${slug}/surveys/${survey.id}`}>
                    <ExternalLinkIcon className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {context?.cacheSizes && (
            <div>
              <h4 className="flex items-center">
                <span className="flex-1">
                  <Trans ns="offline">Cache Status</Trans>
                </span>
                <DropdownButton
                  buttonClassName="border-0 border-opacity-0 shadow-none"
                  label={<CogIcon className="w-5 h-5 text-gray-600" />}
                  small
                  options={[
                    {
                      label: t("Clear cache"),
                      onClick: () => context?.clearOfflineSurveyAssets(),
                    },
                    {
                      label: t("Reload cache"),
                      onClick: async () => {
                        context.populateOfflineSurveyAssets(true);
                      },
                    },
                  ]}
                />
              </h4>
              <CacheProgress
                loading={context.cacheSizes.offlineSurveys.loading}
                percent={
                  context.cacheSizes.offlineSurveys.fractionCached * 100 || 0
                }
                description={
                  <div className="space-x-2">
                    <Badge>
                      <Trans
                        ns="offline"
                        i18nKey="documentCount"
                        count={context.cacheSizes.offlineSurveys.documents}
                      >
                        {{
                          count: context.cacheSizes.offlineSurveys.documents,
                        }}{" "}
                        documents
                      </Trans>
                    </Badge>
                    <Badge>
                      <Trans
                        ns="offline"
                        i18nKey="imageCount"
                        count={context.cacheSizes.offlineSurveys.images}
                      >
                        {{ count: context.cacheSizes.offlineSurveys.images }}{" "}
                        images
                      </Trans>
                    </Badge>

                    <Badge>
                      <Trans
                        ns="offline"
                        i18nKey="questionCount"
                        count={context.cacheSizes.offlineSurveys.questions}
                      >
                        {{
                          count: context.cacheSizes.offlineSurveys.questions,
                        }}{" "}
                        questions
                      </Trans>
                    </Badge>
                    {context.cacheSizes.offlineSurveys.bytes &&
                    context.cacheSizes.offlineSurveys.bytes > 1000 ? (
                      <Badge variant="secondary">
                        {bytes(context.cacheSizes.offlineSurveys.bytes)}
                      </Badge>
                    ) : null}
                  </div>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-center w-full">
          <Spinner />
        </div>
      )}
      <div className="mt-5">
        <Header>
          <Trans ns="offline">Survey-Related Maps</Trans>
        </Header>
        <p className="text-gray-800 text-sm">
          <Trans ns="offline">
            Maps used in selected surveys will each need to be loaded into
            browser cache. The cache state of each map is indicated below.
          </Trans>
        </p>
        <div>
          {surveyBasemaps.map(({ surveys, id, basemaps }) => (
            <div key={id}>
              <h4 className="truncate font-semibold text-sm py-4">
                <Trans>Used in </Trans>
                {surveys.join(", ")}
              </h4>
              <div className="space-y-2">
                {basemaps.map((map) => (
                  <MapItem
                    key={map.id}
                    map={map}
                    onDownloadClick={(id) => setDownloadBasemapModalOpen(map)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {downloadBasemapModalOpen && (
        <DownloadBasemapModal
          map={downloadBasemapModalOpen}
          onRequestClose={() => setDownloadBasemapModalOpen(null)}
        />
      )}
    </Card>
  );
}

function MapItem({
  map,
  onDownloadClick,
}: {
  map: BasemapDetailsAndClientCacheStatus;
  onDownloadClick: (id: number) => void;
}) {
  return (
    <>
      <div className={`flex items-center h-20 w-full overflow-hidden`}>
        <img
          src={map.thumbnail}
          className="w-20 h-20 rounded"
          alt={`${map.name} preview`}
        />
        <div className="px-2 flex-1 h-full">
          <h4 className="text-base truncate mb-1.5">{map.name}</h4>
          <>
            {map.cacheState.state === "complete" && (
              <Badge variant="primary">
                <Trans>Ready for offline use</Trans>
              </Badge>
            )}
            {map.cacheState.state === "incomplete" && (
              <Badge variant="warning">
                <Trans>Not cached</Trans>
              </Badge>
            )}
            {map.cacheState.state === "has-updates" && (
              <Badge variant="warning">
                <Trans>Update available</Trans>
              </Badge>
            )}
          </>
          {map.cacheState.state !== "incomplete" && (
            <div className="text-sm text-gray-500 mt-0.5 ml-0.5">
              {map.cacheState.lastUpdated && (
                // eslint-disable-next-line i18next/no-literal-string
                <span className="text-xs">
                  Downloaded {map.cacheState.lastUpdated.toLocaleDateString()}.
                </span>
              )}{" "}
              {/* {map.bytes && (
                <span className="text-xs">{bytes(map.bytes)}.</span>
              )}{" "} */}
              {map.cacheState.sources[0].downloadedTilePackage && (
                <span className="text-xs">
                  {map.cacheState.sources[0].downloadedTilePackage.maxShorelineZ
                    ? // eslint-disable-next-line i18next/no-literal-string
                      `z${map.cacheState.sources[0].downloadedTilePackage.maxZ}-${map.cacheState.sources[0].downloadedTilePackage.maxShorelineZ}`
                    : // eslint-disable-next-line i18next/no-literal-string
                      `z${map.cacheState.sources[0].downloadedTilePackage.maxZ}`}
                </span>
              )}{" "}
              <button
                className="underline text-xs"
                onClick={() => onDownloadClick(map.id)}
              >
                <Trans ns="offline">Details</Trans>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center">
          <>
            {map.cacheState.state === "complete" ? (
              <CheckCircleIcon className="w-8 h-8 text-primary-600" />
            ) : (
              <Button
                small
                label={
                  map.cacheState.state === "incomplete" ? (
                    <Trans>Download</Trans>
                  ) : (
                    <Trans>Update</Trans>
                  )
                }
                onClick={() => onDownloadClick(map.id)}
              />
            )}
          </>
        </div>
      </div>
    </>
  );
}
