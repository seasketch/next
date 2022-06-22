import { CogIcon } from "@heroicons/react/solid";
import bytes from "bytes";
import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Badge from "../components/Badge";
import DropdownButton from "../components/DropdownButton";
import { CacheProgress } from "./CacheStatus";
import { ClientCacheManagerContext } from "./ClientCacheManager";

export default function StaticAssetCacheStatus() {
  const context = useContext(ClientCacheManagerContext);
  // const {
  //   loading,
  //   // togglePrefetchCaching,
  //   error,
  //   clearCache,
  //   ready,
  //   populateCache,
  // } = useStaticAssetCache();
  const { numFiles, numCached, percentCached } = useMemo(() => {
    if (context?.cacheSizes?.staticAssets) {
      const files = context.cacheSizes.staticAssets.entries;
      const numCached = files.filter((e) => e.cached).length || 0;
      const numFiles = files.length || 0;
      return {
        numCached,
        numFiles,
        percentCached: (numCached / numFiles) * 100,
      };
    } else {
      return {
        numCached: 0,
        numFiles: 0,
        percentCached: 0,
      };
    }
  }, [context?.cacheSizes?.staticAssets]);
  const [showFiles, setShowFiles] = useState(false);
  const { t } = useTranslation("superuser");

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center">
          <h2 className="flex-1">
            {t("Static Asset Cache")}{" "}
            <span
              className="ml-2 cursor-pointer"
              onClick={() =>
                window.alert(
                  t(
                    `Set caching to "Improved Performance" or greater to enable prefetching`
                  )
                )
              }
            >
              <Badge
                variant={
                  context?.level.prefetchEnabled ? "primary" : "secondary"
                }
              >
                {context?.level.prefetchEnabled
                  ? t("prefetch enabled")
                  : "prefetch disabled"}
                {/* <span
                >
                  <QuestionMarkCircleIcon className="ml-1 w-4 h-4 opacity-25" />
                </span> */}
              </Badge>
            </span>
          </h2>
          <DropdownButton
            buttonClassName="border-0 border-opacity-0 shadow-none"
            label={<CogIcon className="w-5 h-5 text-gray-600" />}
            small
            options={[
              {
                label: t("Clear cache"),
                onClick: () => context?.clearStaticAssetCache(),
              },
              {
                label: t("Reload cache"),
                onClick: () => context?.reloadStaticAssetCache(),
              },
            ]}
          />
        </div>
        <p className="text-gray-500 text-sm">
          SeaSketch caches application code and assets for faster access and
          offline use. If prefetch caching is enabled, all application code will
          be cached as soon as SeaSketch is loaded. This cache must be loaded if
          the application is to be used offline.
        </p>
        <div>
          <CacheProgress
            className="mt-4"
            // loading={loading && !ready}
            description={
              <>
                <span>
                  {numCached}/{numFiles}{" "}
                  <button
                    className="underline"
                    onClick={() => setShowFiles(!showFiles)}
                  >
                    {t("files")}
                  </button>
                  .{" "}
                  {context?.cacheSizes?.staticAssets?.bytes
                    ? bytes(context.cacheSizes.staticAssets.bytes)
                    : ""}
                </span>
              </>
            }
            percent={percentCached || 0}
          />
        </div>
        {/* <p className="text-sm text-red-900">{error && error.toString()}</p> */}
        {showFiles && context?.cacheSizes?.staticAssets && (
          <ul className="p-4 max-h-48 overflow-y-auto border border-gray-300">
            {context.cacheSizes.staticAssets.entries.map(({ path, cached }) => (
              <li className="flex items-center" key={path}>
                <span
                  className={`${
                    cached ? "bg-primary-500" : "bg-white border"
                  } rounded-full w-3 h-3 mr-2`}
                >
                  &nbsp;
                </span>
                <span className="truncate flex-1">{path}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
