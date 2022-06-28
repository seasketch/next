import { useMemo } from "react";
import { Trans as T } from "react-i18next";
import { useParams } from "react-router-dom";
import Button from "../components/Button";
import CenteredCardListLayout, {
  Card,
  Header,
} from "../components/CenteredCardListLayout";
import Spinner from "../components/Spinner";
import {
  BasemapDetailsFragment,
  useOfflineSurveyMapsLazyQuery,
  useOfflineSurveyMapsQuery,
} from "../generated/graphql";
import getSlug from "../getSlug";
import { useStyleSources } from "./mapboxApiHelpers";

const Trans = (props: any) => <T ns="admin:offline" {...props} />;

export default function OfflineSurveyMapSettings() {
  const slug = getSlug();
  // eslint-disable-next-line i18next/no-literal-string
  const { data, loading } = useOfflineSurveyMapsQuery({
    variables: {
      slug,
    },
  });

  const surveyBasemaps = useMemo(() => {
    const details: { basemap: BasemapDetailsFragment; surveys: string[] }[] =
      [];
    for (const survey of data?.projectBySlug?.surveys || []) {
      for (const basemap of survey.basemaps || []) {
        const existing = details.find((d) => d.basemap.id === basemap.id);
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
    const detailsBySurveys: {
      surveys: string[];
      id: string;
      basemaps: BasemapDetailsFragment[];
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
    return detailsBySurveys;
  }, [data]);

  return (
    <div>
      <CenteredCardListLayout>
        <Card>
          <Header>
            <Trans>Survey Maps</Trans>
          </Header>
          <p className="text-sm text-gray-500 py-2">
            <Trans>
              Map data used in surveys used offline will need to be downloaded
              on each machine to be used in the field. Online maps may consist
              of millions of tiles and hundreds of gigabytes of data. Using the
              setting below, administrators can specify a subset of the map data
              that will need to be downloaded for offline use.
            </Trans>
          </p>
          {loading ? (
            <div className="flex items-center justify-center w-full py-5">
              <Spinner />
            </div>
          ) : (
            surveyBasemaps.map((details) => {
              return (
                <div key={details.id}>
                  <h4 className="truncate font-semibold text-sm py-4">
                    <Trans>Used in </Trans>
                    {details.surveys.join(", ")}
                  </h4>
                  {details.basemaps.map((map) => (
                    <MapItem
                      mapboxApiKey={
                        data!.projectBySlug!.mapboxPublicKey ||
                        process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
                      }
                      key={map.id}
                      map={map}
                    />
                  ))}
                </div>
              );
            })
          )}
        </Card>
      </CenteredCardListLayout>
    </div>
  );
}

function MapItem({
  map,
  mapboxApiKey,
}: {
  map: BasemapDetailsFragment;
  mapboxApiKey: string;
}) {
  const { sources, loading, error } = useStyleSources(map.url, mapboxApiKey);

  return (
    <div className="flex py-2 items-center h-24">
      <img
        src={map.thumbnail}
        className="w-20 h-20 rounded"
        alt={`${map.name} preview`}
      />
      <div className="px-2 flex-1 h-full">
        <h4 className="text-base">{map.name}</h4>

        {loading && <Spinner />}
        {sources && sources.map((s) => s.type).join(", ")}
        {error}
      </div>
      <Button label={<Trans>Enable</Trans>} />
    </div>
  );
}
