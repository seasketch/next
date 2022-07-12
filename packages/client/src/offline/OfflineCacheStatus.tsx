import { CogIcon } from "@heroicons/react/outline";
import bytes from "bytes";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import DropdownButton from "../components/DropdownButton";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import useStaticAssetCache from "../useStaticAssetCache";
import { CacheProgress } from "./CacheStatus";

export default function OfflineCacheStatus() {
  const {
    cacheState,
    loading,
    togglePrefetchCaching,
    error,
    clearCache,
    ready,
    populateCache,
  } = useStaticAssetCache();
  const { numFiles, numCached, percentCached } = useMemo(() => {
    const numCached = cacheState?.entries.filter((e) => e.cached).length || 0;
    const numFiles = cacheState?.entries.length || 0;
    return {
      numCached,
      numFiles,
      percentCached: (numCached / numFiles) * 100,
    };
  }, [cacheState]);
  const [showFiles, setShowFiles] = useState(false);
  const { t } = useTranslation("superuser");

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center">
          <h2 className="flex-1">{t("Offline Static Asset Cache")}</h2>
          <DropdownButton
            buttonClassName="border-0 border-opacity-0 shadow-none"
            label={<CogIcon className="w-5 h-5 text-gray-600" />}
            small
            options={[
              { label: t("Clear cache"), onClick: () => clearCache() },
              {
                label: t("Reload cache"),
                onClick: () =>
                  clearCache().then(() => setTimeout(populateCache, 200)),
              },
            ]}
          />
        </div>
        <p className="text-gray-500 text-sm">
          SeaSketch caches application code for faster access and offline use.
          If prefetch caching is enabled, all application code will be cached as
          soon as SeaSketch is loaded.
        </p>
        {ready && (
          <InputBlock
            title={t("Precaching Enabled")}
            input={
              <Switch
                isToggled={cacheState?.precacheEnabled || false}
                onClick={togglePrefetchCaching}
              />
            }
          />
        )}
        <div>
          <CacheProgress
            className="mt-4"
            loading={loading && !ready}
            description={
              <span>
                {numCached}/{numFiles}{" "}
                <button
                  className="underline"
                  onClick={() => setShowFiles(!showFiles)}
                >
                  {t("files")}
                </button>
                . {cacheState ? bytes(cacheState.bytes) : ""}
              </span>
            }
            percent={percentCached || 0}
          />
        </div>
        <p className="text-sm text-red-900">{error && error.toString()}</p>
        {showFiles && cacheState && (
          <ul className="p-4">
            {cacheState.entries.map(({ path, cached }) => (
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
