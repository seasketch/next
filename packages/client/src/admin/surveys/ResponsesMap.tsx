import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import MapboxMap from "../../components/MapboxMap";
import MapContextManager, {
  ClientDataLayer,
  ClientDataSource,
  MapContext,
} from "../../dataLayers/MapContextManager";
import {
  DataSource,
  DataSourceTypes,
  FormElementDetailsFragment,
  RenderUnderType,
  SurveyListDetailsFragment,
  useSurveyMapDetailsQuery,
} from "../../generated/graphql";
import useAccessToken from "../../useAccessToken";
import MiniBasemapSelector from "../data/MiniBasemapSelector";
import useMapEssentials from "./useMapEssentials";

export default function ResponsesMap({ surveyId }: { surveyId: number }) {
  const token = useAccessToken();
  const essentials = useMapEssentials({});
  const { data } = useSurveyMapDetailsQuery({
    variables: {
      surveyId,
    },
  });
  const [spatialQuestions, setSpatialQuestions] = useState<
    FormElementDetailsFragment[]
  >([]);
  const [selectedQuestion, setSelectedQuestion] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (data?.survey?.form?.formElements) {
      const spatial = data.survey.form.formElements.filter(
        (f) => f.type?.isSpatial
      );
      setSpatialQuestions(spatial);
      setSelectedQuestion(spatial[0]?.exportId || undefined);
    } else {
      setSpatialQuestions([]);
    }
  }, [data?.survey?.form?.formElements]);

  useEffect(() => {
    let dataSources: ClientDataSource[] = [];
    let layers: ClientDataLayer[] = [];
    if (selectedQuestion) {
      const element = spatialQuestions.find(
        (el) => el.exportId === selectedQuestion
      )!;
      // eslint-disable-next-line i18next/no-literal-string
      const dataSourceId = `${selectedQuestion}-source`;
      dataSources.push({
        id: dataSourceId,
        type: DataSourceTypes.Geojson,
        supportsDynamicLayers: false,
        url: `${process.env.REACT_APP_GRAPHQL_ENDPOINT!.replace(
          "/graphql",
          // eslint-disable-next-line i18next/no-literal-string
          `/export-survey/${surveyId}/spatial/${element.id}/geojson`
        )}`,
      });
      // dataSources.push({
      //   id: dataSourceId,
      //   type: DataSourceTypes.Vector,
      //   supportsDynamicLayers: false,
      //   tiles: [
      //     `${process.env.REACT_APP_GRAPHQL_ENDPOINT!.replace(
      //       "/graphql",
      //       // eslint-disable-next-line i18next/no-literal-string
      //       `/export-survey/${surveyId}/spatial/${element.id}/tiles/{z}/{x}/{y}.pbf`
      //     )}`,
      //   ],
      // });
      layers.push({
        // eslint-disable-next-line i18next/no-literal-string
        dataSourceId,
        id: selectedQuestion,
        renderUnder: RenderUnderType.Labels,
        zIndex: 1,
        mapboxGlStyles: [
          {
            type: "fill",
            layout: {},
            // "source-layer": "sketches",
            paint: {
              "fill-color": "#881011", // blue color fill
              "fill-opacity": 0.15,
            },
          },
        ],
      });
    }
    essentials.mapContext.manager?.reset(dataSources, layers);
    if (selectedQuestion) {
      essentials.mapContext.manager?.setVisibleLayers([selectedQuestion!]);
    } else {
      essentials.mapContext.manager?.setVisibleLayers([]);
    }
  }, [selectedQuestion]);

  return (
    <MapContext.Provider value={essentials.mapContext}>
      <MiniBasemapSelector basemaps={essentials.basemaps} />
      <MapboxMap
        className="w-full h-full"
        initOptions={{
          // @ts-ignore
          transformRequest: (url, resourceType) => {
            if (
              new URL(url).host ===
                new URL(process.env.REACT_APP_GRAPHQL_ENDPOINT!).host &&
              token
            ) {
              return {
                url: url + `?time=${new Date().getTime()}`,
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              };
            } else {
              return null;
            }
          },
        }}
      />
      {spatialQuestions && (
        <select
          className="absolute top-0 right-0 text-sm rounded mt-1 mr-1"
          value={selectedQuestion}
        >
          {spatialQuestions.map((el) => (
            <option key={el.exportId!} value={el.exportId!}>
              {el.exportId}
            </option>
          ))}
        </select>
      )}
    </MapContext.Provider>
  );
}
