/* eslint-disable i18next/no-literal-string */
import bytes from "bytes";
import {
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { Card } from "../components/CenteredCardListLayout";
import Modal from "../components/Modal";
import { useLocalForage } from "../useLocalForage";
import { CacheProgress } from "./CacheStatus";
import {
  ClientCacheSettings,
  CLIENT_CACHE_SETTINGS_KEY,
  defaultCacheSetting,
} from "./ClientCacheSettings";
import {
  CacheInformation,
  ClientCacheManagerContext,
  ClientCacheContextValue,
} from "./ClientCacheManager";
import StaticAssetCacheStatus from "./StaticAssetCacheStatus";
import { PieChart } from "react-minimal-pie-chart";
import { schemeTableau10 } from "d3-scale-chromatic";
import OfflineSurveySelection from "./OfflineSurveySelection";
import { useParams } from "react-router-dom";
import useProjectId from "../useProjectId";
import ErrorBoundaryFallback from "../components/ErrorBoundaryFallback";
import { useProjectMetadataQuery } from "../generated/graphql";
import getSlug from "../getSlug";
import { ErrorBoundary } from "@sentry/react";

function label(id: string) {
  switch (id) {
    case "minimum":
      return <Trans ns="cache-settings">Minimum</Trans>;
    case "default":
      return <Trans ns="cache-settings">Default</Trans>;
    case "improved":
      return <Trans ns="cache-settings">Improved Performance</Trans>;
    case "max":
      return <Trans ns="cache-settings">Maximum</Trans>;
    default:
      return <Trans ns="cache-settings">Minimum</Trans>;
  }
}

function description(id: string) {
  switch (id) {
    case "minimum":
      return (
        <Trans ns="cache-settings">
          Only what's necessary to run SeaSketch
        </Trans>
      );
    case "default":
      return (
        <Trans ns="cache-settings">
          Saves some recently used app data for improved startup performance and
          use over poor internet connections
        </Trans>
      );
    case "improved":
      return (
        <Trans ns="cache-settings">
          Caches more data and preloads assets for better performance. Supports
          offline use.
        </Trans>
      );

    case "max":
      return (
        <Trans ns="cache-settings">
          Use this setting if you are a facilitator or planner who uses
          SeaSketch regularly. Supports offline use.
        </Trans>
      );
  }
}

export function CacheSettingCards() {
  const { t } = useTranslation("cache-settings");

  const context = useContext(ClientCacheManagerContext);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data } = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const level = context?.level || defaultCacheSetting;
  const quotaPercent =
    context?.storageEstimate?.quota && context.storageEstimate.usage
      ? Math.round(
          (context.storageEstimate.usage / context.storageEstimate.quota) *
            10000
        ) / 100
      : 0;

  return (
    <>
      <Card>
        <h4 className="py-1">{t("Data Caching")}</h4>
        <div className="mx-7 mt-4">
          <input
            className="w-full"
            type="range"
            min={1}
            max={ClientCacheSettings.length}
            value={
              ClientCacheSettings.findIndex(
                (l) => l.id === (level?.id || "default")
              ) + 1
            }
            onChange={(e) => {
              context?.setLevel(
                ClientCacheSettings[parseInt(e.target.value) - 1].id
              );
            }}
          ></input>
        </div>
        <div className="text-sm flex mx-2">
          <div className="text-left w-24">
            {label(ClientCacheSettings[0].id)}
          </div>
          <div className="flex flex-1 -mx-2.5">
            {ClientCacheSettings.slice(1, ClientCacheSettings.length - 1).map(
              (choice) => (
                <div key={choice.id} className={`flex-1 text-center`}>
                  {label(choice.id)}
                </div>
              )
            )}
          </div>
          <div className="text-right w-24">
            {label(ClientCacheSettings[ClientCacheSettings.length - 1].id)}
          </div>
        </div>
        <div className="text-sm text-gray-800 py-2 mt-2">
          {description(level.id)}
        </div>
        {context?.storageEstimate && (
          <div
            className={`text-sm text-gray-500 mt-1 ${
              quotaPercent > 0.75 && "text-red-800"
            }`}
          >
            Using {quotaPercent}% of storage quota.{" "}
            <button
              onClick={() => {
                if (
                  context &&
                  // !context.cacheSizes &&
                  !context.updatingCacheSizes
                ) {
                  context.updateCacheSizes();
                }
                setDetailsOpen(true);
              }}
              className="underline"
            >
              {t("Cache Details")}
            </button>
          </div>
        )}
        {detailsOpen && context && (
          <ClientCacheDetailsModal
            context={context}
            onRequestClose={() => setDetailsOpen(false)}
            loading={context ? context.updatingCacheSizes : true}
            stats={context?.cacheSizes}
          />
        )}
      </Card>
      {data?.project?.isOfflineEnabled && (
        <ErrorBoundary
          fallback={
            <ErrorBoundaryFallback
              title={
                <Trans ns="offline">
                  Failed to render offline settings. Is ServiceWorker enabled?
                </Trans>
              }
            />
          }
        >
          <OfflineSurveySelection />
        </ErrorBoundary>
      )}
    </>
  );
}

function ClientCacheDetailsModal({
  loading,
  onRequestClose,
  stats,
  context,
}: {
  loading: boolean;
  onRequestClose: () => void;
  stats?: CacheInformation;
  context: ClientCacheContextValue;
}) {
  const [showFiles, setShowFiles] = useState(false);
  const { t } = useTranslation("cache-settings");
  const quotaPercent =
    context.storageEstimate?.quota && context.storageEstimate.usage
      ? context.storageEstimate.usage / context.storageEstimate.quota
      : 0;
  const percent = Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: 2,
  });

  const queryCacheItems = useMemo(() => {
    const items: {
      name: string;
      numberOfEntries: number;
      bytes: number;
      fraction: number;
    }[] = [];
    if (stats?.queries.strategies.length) {
      for (const strategy of stats.queries.strategies) {
        items.push({
          name:
            strategy.type === "lru"
              ? `Recent ${strategy.queryName} (${strategy.entries}/${strategy.limit})`
              : strategy.type === "byArgs"
              ? `Chosen ${strategy.queryName} (${strategy.entries})`
              : strategy.queryName,
          numberOfEntries: strategy.entries,
          bytes: strategy.bytes,
          fraction: strategy.bytes / stats.queries.bytes,
        });
      }
    }
    return items;
  }, [stats]);
  return (
    <Modal onRequestClose={onRequestClose} open={true} loading={loading}>
      {stats && (
        <div className="max-w-xl space-y-4">
          <div className="mb-4">
            <h2
              className={`flex-1 mb-1 ${quotaPercent > 0.8 && "text-red-800"}`}
            >
              <Trans ns="cache-settings">
                Using {percent.format(quotaPercent)} of your browser's storage
                quota
              </Trans>
            </h2>
            <p className="text-gray-500 text-sm">
              Your web browser will allocate space for SeaSketch to store cache
              data based on the amount of free disk space. If this number
              approaches 100%, you may lose data and the ability to work
              offline.
            </p>
          </div>
          <StaticAssetCacheStatus />
          <div className="mb-4 mt-2">
            <h2 className="flex-1 mb-1">
              <Trans ns="cache-settings">Query Cache</Trans>
            </h2>
            <div className="flex">
              <p className="text-gray-500 text-sm flex-1">
                The query cache stores data related to your projects that have
                been recently used. The helps the application start faster using
                cached data, while fetching updates in the background when the
                network is available.
              </p>
              <div className="ml-4 w-48 h-48 -mt-14 pb-1">
                <PieChart
                  style={{ height: "100%" }}
                  data={queryCacheItems
                    .filter((c) => c.bytes > 0)
                    .map((c, i) => ({
                      title: `${c.name} ${bytes(c.bytes)}`,
                      value: c.bytes,
                      color: schemeTableau10[i % 10],
                      bytes: c.bytes,
                    }))}
                  label={(d) => bytes(d.dataEntry.bytes)}
                  radius={26}
                  labelStyle={(index) => ({
                    fill: schemeTableau10[index % 10],
                    fontSize: "5px",
                    fontFamily: "sans-serif",
                  })}
                  labelPosition={115}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
