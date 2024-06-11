/* eslint-disable i18next/no-literal-string */
import bytes from "bytes";
import { useContext, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Card } from "../components/CenteredCardListLayout";
import {
  ClientCacheSettings,
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
import ErrorBoundaryFallback from "../components/ErrorBoundaryFallback";
import { useProjectMetadataQuery } from "../generated/graphql";
import getSlug from "../getSlug";
import { ErrorBoundary } from "@sentry/react";
import { DownloadManagerContext } from "./MapDownloadManager";
import Modal from "../components/Modal";
import ServiceWorkerWindow from "./ServiceWorkerWindow";
import { Route, useHistory } from "react-router-dom";

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

export function CacheSettingCards({ className }: { className?: string }) {
  const { t } = useTranslation("cache-settings");
  const [dlContextValue, setDlContextValue] = useState(0);
  const history = useHistory();

  const context = useContext(ClientCacheManagerContext);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data } = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
  });

  useEffect(() => {
    // when user first opens this window, check if prefetching should be enabled, and if so,
    // populate the cache. Service worker and settings change handlers should perform this,
    // but I'd like an extra step to make sure prefetching works if the user is proactively
    // checking their offline readiness
    if (context?.level.prefetchEnabled) {
      const doUpdate = async () => {
        if (context) {
          await context.staticAssetCache.populateCache();
          await context.updateCacheSizes();
        }
      };
      setTimeout(() => {
        if (
          context.cacheSizes &&
          context.cacheSizes.staticAssets.entries.find((e) => !e.cached)
        ) {
          doUpdate();
        }
      }, 200);

      setTimeout(() => {
        context.updateCacheSizes();
      }, 2000);
    }
  }, [context?.level?.prefetchEnabled]);

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
      <Card className={className}>
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
                history.replace(`/${getSlug()}/app/settings/cacheDetails`);
              }}
              className="underline"
            >
              {t("Cache Details")}
            </button>
          </div>
        )}
        <Route path={`/${getSlug()}/app/settings/cacheDetails`}>
          {context && (
            <ClientCacheDetailsModal
              context={context}
              onRequestClose={() => {
                history.replace(`/${getSlug()}/app/settings`);
              }}
              loading={
                context
                  ? context.updatingCacheSizes && !context.cacheSizes
                  : true
              }
              stats={context?.cacheSizes}
            />
          )}
        </Route>
        {/* {detailsOpen && context && (
          <ClientCacheDetailsModal
            context={context}
            onRequestClose={() => setDetailsOpen(false)}
            loading={context ? context.updatingCacheSizes : true}
            stats={context?.cacheSizes}
          />
        )} */}
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
          <DownloadManagerContext.Provider
            value={{
              iter: dlContextValue,
              bump: () => setDlContextValue((prev) => prev + 1),
            }}
          >
            <OfflineSurveySelection className={className} />
          </DownloadManagerContext.Provider>
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
  context?: ClientCacheContextValue;
}) {
  const [swBuild, setSwBuild] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setSwBuild(ServiceWorkerWindow.build);
  }, [ServiceWorkerWindow.build]);

  const quotaPercent =
    context?.storageEstimate?.quota && context.storageEstimate.usage
      ? context.storageEstimate.usage / context.storageEstimate.quota
      : 0;
  const percent = Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: 2,
  });

  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<
    ServiceWorkerRegistration | null | undefined
  >(undefined);

  useEffect(() => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      setServiceWorkerRegistration(registration);
    });
  }, [navigator.serviceWorker]);

  useEffect(() => {
    context?.updateCacheSizes();
  }, [ServiceWorkerWindow.build]);

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
    <Modal
      onRequestClose={onRequestClose}
      loading={loading}
      title={<Trans ns="cache-settings">Cache Status</Trans>}
    >
      {stats && (
        <div className="space-y-4">
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
              <Trans ns="cache-settings">Service Worker</Trans>
            </h2>
            <div className="">
              <p className="text-gray-500 text-sm flex-1 mb-1">
                The service worker is a background process that helps SeaSketch
                work offline, acting as an <i>offline server</i> which resolves
                requests from cache. While this service updates automatically,
                you can also{" "}
                <button
                  className="underline"
                  onClick={async () => {
                    await serviceWorkerRegistration?.update();
                    // await serviceWorkerRegistration?.unregister();
                    window.location.reload();
                  }}
                >
                  force-update the service worker
                </button>
              </p>
              <ServiceWorkerRegistration
                registration={serviceWorkerRegistration}
                build={swBuild}
              />
            </div>
          </div>
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

function ServiceWorkerRegistration({
  registration,
  build,
}: {
  registration?: ServiceWorkerRegistration | null;
  build?: string | null | undefined;
}) {
  let status: "active" | "installing" | "waiting" | "none" | "out-of-date" =
    "none";
  let current: ServiceWorker | undefined;
  if (registration?.active) {
    status = "active";
    current = registration.active;
  } else if (registration?.installing) {
    status = "installing";
    current = registration.installing;
  } else if (registration?.waiting) {
    status = "waiting";
    current = registration.waiting;
  }
  const appBuild = process.env.REACT_APP_BUILD || "local";
  if (build && build !== appBuild) {
    status = "out-of-date";
  }
  return (
    <div
      className={`flex font-mono text-sm items-center ${
        status === "active"
          ? "text-green-800"
          : status === "none"
          ? "text-red-700"
          : "text-yellow-700"
      }`}
    >
      {current && (
        <>
          <div className="flex-1">{current.scriptURL}</div>
          <div>
            {current.state} ({build}
            {status === "out-of-date" && " outdated"})
          </div>
        </>
      )}
      {!current && status === "none" && (
        <div>
          <Trans ns="cache-settings">No service worker found!</Trans>
        </div>
      )}
    </div>
  );
}
