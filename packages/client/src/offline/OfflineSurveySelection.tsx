import { ExternalLinkIcon } from "@heroicons/react/outline";
import { CheckCircleIcon, CogIcon } from "@heroicons/react/solid";
import bytes from "bytes";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Trans as T, useTranslation } from "react-i18next";
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
import ImportMbtilesModal from "./ImportMbtilesModal";
import isGoogleChrome from "./isGoogleChrome";
import useBasemapsBySurvey, {
  BasemapDetailsAndClientCacheStatus,
} from "./useBasemapsBySurvey";

const Trans = (props: any) => (
  <T ns="offline" {...props}>
    {props.children}
  </T>
);

export default function OfflineSurveySelection({
  className,
}: {
  className?: string;
}) {
  const slug = window.location.pathname.split("/")[1];
  const context = useContext(ClientCacheManagerContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [mbtilesFileList, setMbtilesFileList] = useState<FileList | null>(null);

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
    <Card className={className}>
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
      {!isGoogleChrome && (
        <Warning>
          <Trans>
            Offline functionality is only supported using Google Chrome. Other
            browsers have restrictions that prevent the caching of large amounts
            of map data, and may have other problems.
            <br />
            <br /> Please{" "}
            <a
              className="underline"
              href="https://www.google.com/chrome/downloads/"
            >
              download Google Chrome
            </a>
          </Trans>
        </Warning>
      )}
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
          {surveyBasemaps.length > 0 && (
            <div className="text-sm p-2 rounded bg-gray-100 my-4 flex items-center">
              <div className="px-2">
                <Trans>
                  You can also prepare offline maps using mbtiles packages
                  provided by an admin.
                </Trans>
              </div>
              <label className="bg-white rounded cursor-pointer border shadow-sm px-2 pr-4 py-0.5 text-black whitespace-nowrap mx-1 flex items-center">
                <input
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      setMbtilesFileList(e.target.files);
                    } else {
                      setMbtilesFileList(null);
                    }
                  }}
                  multiple
                  className="hidden"
                  accept=".mbtiles"
                  type="file"
                />
                <svg
                  viewBox="0 0 100 100"
                  height="36"
                  width="36"
                  focusable="false"
                  role="img"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-gray-500"
                >
                  <path d="M64.603 35.504a2.777 2.777 0 00-2.774-2.72c-.047 0-.091.012-.138.014h-2.039V17.774a1.687 1.687 0 00-1.684-1.684H41.765v.03a1.681 1.681 0 00-1.386 1.654v15.022h-2.052c-.043-.002-.083-.013-.126-.013a2.776 2.776 0 00-2.774 2.72h-.036v45.625h.001a2.782 2.782 0 002.78 2.781l.014-.001h23.643a2.78 2.78 0 002.78-2.779V35.504h-.006zm-9.938-2.706h-9.329v-11.72h9.329v11.72z"></path>
                  <path d="M47.506 27.933h4.988v2.072h-4.988z"></path>
                </svg>
                <Trans>Select files</Trans>
              </label>
            </div>
          )}
        </div>
      </div>
      {downloadBasemapModalOpen && (
        <DownloadBasemapModal
          map={downloadBasemapModalOpen}
          onRequestClose={() => setDownloadBasemapModalOpen(null)}
        />
      )}
      {mbtilesFileList && (
        <ImportMbtilesModal
          files={mbtilesFileList}
          onRequestClose={() => {
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
            setMbtilesFileList(null);
          }}
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
                <span className="text-xs hidden 2xl:inline-block">
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
