import { useContext, useEffect, useState } from "react";
import {
  OfflineBasemapDetailsFragment,
  OfflineTilePackageStatus,
  useOfflineSurveyMapsQuery,
} from "../generated/graphql";
import getSlug from "../getSlug";
import {
  CacheStatusForBasemap,
  DownloadManagerContext,
  getCacheStatusForBasemap,
} from "./MapDownloadManager";

export type BasemapDetailsAndClientCacheStatus =
  OfflineBasemapDetailsFragment & {
    cacheState: CacheStatusForBasemap;
  };

export default function useBasemapsBySurvey(
  filterToSurveyIds?: number[],
  excludeMapsWithMissingSources?: boolean
) {
  const context = useContext(DownloadManagerContext);
  const slug = getSlug();

  const { data, loading, refetch } = useOfflineSurveyMapsQuery({
    variables: {
      slug,
    },
  });

  const [surveyBasemaps, setSurveyBasemaps] = useState<
    {
      surveys: string[];
      id: string;
      basemaps: BasemapDetailsAndClientCacheStatus[];
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const details: {
        basemap: BasemapDetailsAndClientCacheStatus;
        surveys: string[];
      }[] = [];
      for (const survey of data?.projectBySlug?.surveys || []) {
        if (!filterToSurveyIds || filterToSurveyIds.indexOf(survey.id) !== -1) {
          for (const basemap of survey.basemaps || []) {
            const existing = details.find((d) => d.basemap.id === basemap.id);
            const missingPkg = basemap.offlineSupportInformation?.sources.find(
              (s) =>
                s.tilePackages.filter(
                  (pkg) => pkg.jobStatus === OfflineTilePackageStatus.Complete
                ).length === 0
            );
            if (!missingPkg || !excludeMapsWithMissingSources) {
              if (existing) {
                if (existing.surveys.indexOf(survey.name) === -1) {
                  existing.surveys.push(survey.name);
                }
              } else {
                const cacheState = await getCacheStatusForBasemap(
                  basemap.id,
                  basemap.offlineSupportInformation!
                );
                details.push({
                  basemap: {
                    ...basemap,
                    cacheState,
                  },
                  surveys: [survey.name],
                });
              }
            }
          }
        }
      }
      const detailsBySurveys: {
        surveys: string[];
        id: string;
        basemaps: BasemapDetailsAndClientCacheStatus[];
      }[] = [];
      for (const detail of details) {
        const id = detail.surveys.join("-");
        const existing = detailsBySurveys.find((d) => d.id === id);
        if (existing) {
          existing.basemaps.push(detail.basemap);
        } else {
          detailsBySurveys.push({
            id,
            basemaps: [detail.basemap],
            surveys: detail.surveys,
          });
        }
      }
      for (const detail of detailsBySurveys) {
        detail.basemaps = detail.basemaps.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      }
      setSurveyBasemaps(
        detailsBySurveys.sort((a, b) => b.surveys.length - a.surveys.length)
      );
    })();
  }, [
    data?.projectBySlug?.offlineTileSettings,
    data?.projectBySlug?.surveys,
    filterToSurveyIds,
    excludeMapsWithMissingSources,
    context,
  ]);

  return { surveyBasemaps, refetch, loading };
}
