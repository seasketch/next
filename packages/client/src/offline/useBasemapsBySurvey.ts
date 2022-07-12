import { useEffect, useMemo, useState } from "react";
import {
  OfflineBasemapDetailsFragment,
  useOfflineSurveyMapsQuery,
} from "../generated/graphql";
import getSlug from "../getSlug";
import { getSources } from "./mapboxApiHelpers";
import { urlForSource } from "./OfflineSurveyMapSettings";

export default function useBasemapsBySurvey(
  filterToSurveyIds?: number[],
  excludeMapsWithMissingSources?: boolean
) {
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
      basemaps: OfflineBasemapDetailsFragment[];
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const details: {
        basemap: OfflineBasemapDetailsFragment;
        surveys: string[];
      }[] = [];
      for (const survey of data?.projectBySlug?.surveys || []) {
        if (!filterToSurveyIds || filterToSurveyIds.indexOf(survey.id) !== -1) {
          for (const basemap of survey.basemaps || []) {
            const existing = details.find((d) => d.basemap.id === basemap.id);
            let missingPkg = false;
            if (excludeMapsWithMissingSources) {
              const sources = await getSources(
                basemap.url,
                data?.projectBySlug?.mapboxPublicKey ||
                  process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
              );
              for (const source of sources) {
                const offlineTilePackage = (
                  data?.projectBySlug?.offlineTilePackagesConnection.nodes || []
                ).find((pkg) => pkg.dataSourceUrl === urlForSource(source));
                if (!offlineTilePackage) {
                  missingPkg = true;
                }
              }
            }
            if (!missingPkg) {
              if (existing) {
                if (existing.surveys.indexOf(survey.name) === -1) {
                  existing.surveys.push(survey.name);
                }
              } else {
                details.push({
                  basemap,
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
        basemaps: OfflineBasemapDetailsFragment[];
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
  ]);

  return { surveyBasemaps, refetch, loading };
}
