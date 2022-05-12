import { CogIcon } from "@heroicons/react/outline";
import bytes from "bytes";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../components/Button";
import CenteredCardListLayout, {
  Card,
} from "../components/CenteredCardListLayout";
import DropdownButton from "../components/DropdownButton";
import InputBlock from "../components/InputBlock";
import Spinner from "../components/Spinner";
import Switch from "../components/Switch";
import useIsSuperuser from "../useIsSuperuser";
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
            // eslint-disable-next-line i18next/no-literal-string
            description={`${numCached}/${numFiles} files. ${
              cacheState ? bytes(cacheState.bytes) : ""
            }`}
            percent={percentCached || 0}
          />
        </div>
        <p className="text-sm text-red-900">{error && error.toString()}</p>
      </div>
    </>
  );
}
