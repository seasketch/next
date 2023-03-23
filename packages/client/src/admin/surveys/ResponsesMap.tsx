import bbox from "@turf/bbox";
import { Feature } from "geojson";
import { Layer, MapMouseEvent, Popup } from "mapbox-gl";
import { useEffect, useMemo, useState } from "react";
import { render } from "react-dom";
import { Trans } from "react-i18next";
import MapboxMap from "../../components/MapboxMap";
import { MapContext } from "../../dataLayers/MapContextManager";
import {
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  DataSourceTypes,
  FormElementDetailsFragment,
  RenderUnderType,
  useSurveyMapDetailsQuery,
  useSurveyResponsesQuery,
} from "../../generated/graphql";
import useAccessToken from "../../useAccessToken";
import MiniBasemapSelector from "../data/MiniBasemapSelector";
import { ResponseGridTabName } from "./ResponseGrid";
import useMapEssentials from "./useMapEssentials";

function getFilter(tab: ResponseGridTabName) {
  if (tab === "practice") {
    return ["all", ["==", "practice", true], ["==", "archived", false]];
  } else if (tab === "archived") {
    return ["==", "archived", true];
  } else {
    return ["all", ["==", "practice", false], ["==", "archived", false]];
  }
}

export default function ResponsesMap({
  surveyId,
  onClickResponses,
  selection,
  filter,
  mapTileCacheBuster,
}: {
  surveyId: number;
  onClickResponses?: (ids: number[]) => void;
  selection: number[];
  filter: ResponseGridTabName;
  mapTileCacheBuster: number;
}) {
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
  const responsesQuery = useSurveyResponsesQuery({
    variables: {
      surveyId: surveyId,
    },
    fetchPolicy: "cache-only",
  });

  useEffect(() => {
    if (
      responsesQuery.data?.survey?.responsesSpatialExtent &&
      essentials.mapContext.manager?.map
    ) {
      const feature = JSON.parse(
        responsesQuery.data.survey.responsesSpatialExtent
      );
      const extent = bbox(feature);
      essentials.mapContext.manager.map.fitBounds(
        extent as [number, number, number, number],
        { duration: 250, animate: true, padding: 50 }
      );
    }
  }, [
    responsesQuery.data?.survey?.responsesSpatialExtent,
    essentials.mapContext.manager?.map,
  ]);

  useEffect(() => {
    const map = essentials.mapContext.manager?.map;
    const responses =
      responsesQuery.data?.survey?.surveyResponsesConnection?.nodes;
    const questionId = spatialQuestions.find(
      (q) => q.exportId === selectedQuestion
    )?.id;
    if (
      essentials.mapContext.ready &&
      map &&
      selectedQuestion &&
      responses?.length &&
      questionId &&
      map.loaded()
    ) {
      // eslint-disable-next-line i18next/no-literal-string
      const sourceId = `${selectedQuestion}-source`;

      for (const response of responses) {
        const collection = response.data[questionId]?.collection || [];
        let selected = false;
        if (selection.indexOf(response.id) !== -1) {
          selected = true;
        }

        if (collection?.length) {
          for (const id of collection) {
            map.setFeatureState(
              {
                source: sourceId,
                sourceLayer: "sketches",
                id,
              },
              {
                selected,
              }
            );
          }
        }
      }
    }
  }, [
    selection,
    essentials.mapContext.manager?.map,
    essentials.mapContext.ready,
    selectedQuestion,
    essentials.mapContext.manager?.map?.loaded,
  ]);

  useEffect(() => {
    const map = essentials.mapContext.manager?.map;
    if (map) {
      map.setFilter(
        // eslint-disable-next-line i18next/no-literal-string
        `seasketch/${selectedQuestion}/0`,
        getFilter(filter)
      );
      map.setFilter(
        // eslint-disable-next-line i18next/no-literal-string
        `seasketch/${selectedQuestion}/1`,
        getFilter(filter)
      );
    }
  }, [filter]);

  const NameElement = useMemo(
    () =>
      (data?.survey?.form?.formElements || []).find(
        (el) => el.typeId === "Name"
      ),
    [data?.survey?.form?.formElements]
  );

  const EmailElement = useMemo(
    () =>
      (data?.survey?.form?.formElements || []).find(
        (el) => el.typeId === "Email"
      ),
    [data?.survey?.form?.formElements]
  );

  function getNameOrEmail(data: { [key: string]: any }) {
    if (NameElement && EmailElement) {
      return data[NameElement.id]?.name || data[EmailElement.id] || null;
    } else if (NameElement) {
      return data[NameElement.id]?.name || null;
    } else if (EmailElement) {
      return data[EmailElement.id] || null;
    }
    return null;
  }

  useEffect(() => {
    if (essentials.mapContext.manager?.map && selectedQuestion) {
      const map = essentials.mapContext.manager.map;
      // Set a timeout in case the style hasn't been updated with the layer yet
      setTimeout(() => {
        const layer: Layer | undefined = map
          .getStyle()
          .layers?.find((l) => new RegExp(selectedQuestion).test(l.id));
        if (layer) {
          const popup = new Popup({
            closeButton: true,
            closeOnClick: true,
          });
          const overListener = (e: MapMouseEvent) => {
            map.getCanvas().style.cursor = "pointer";
          };
          const outListener = (e: MapMouseEvent) => {
            map.getCanvas().style.cursor = "default";
          };
          const clickListener = (
            e: MapMouseEvent & { features: [Feature<any>] }
          ) => {
            const uniqueResponseIds: { [id: number]: any } = {};
            const uniqueSketchIds: { [id: number]: any } = {};
            for (const feature of e.features) {
              if (
                feature.properties &&
                feature.properties.response_id &&
                feature.id
              ) {
                uniqueResponseIds[feature.properties.response_id] = true;
                uniqueSketchIds[feature.id as number] = true;
              }
            }
            const responses = (
              responsesQuery.data?.survey?.surveyResponsesConnection?.nodes ||
              []
            ).filter((r) => uniqueResponseIds[r.id]);
            const limit = 5;
            const count = responses.length;
            const content = (
              <div className="w-48 space-y-2">
                <h4>
                  {count}{" "}
                  {count === 1 ? (
                    <Trans ns="admin:surveys">response</Trans>
                  ) : (
                    <Trans ns="admin:surveys">responses</Trans>
                  )}
                  {count > 1 && (
                    <button
                      className="underline ml-2"
                      onClick={() => {
                        if (onClickResponses) {
                          onClickResponses(responses.map((r) => r.id));
                        }
                      }}
                    >
                      <Trans ns="admin:surveys">select all</Trans>
                    </button>
                  )}
                </h4>
                {responses.slice(0, limit).map((r) => (
                  <div key={r.id} className="flex space-x-2">
                    <button
                      title="select"
                      onClick={() => {
                        if (onClickResponses) {
                          onClickResponses([r.id]);
                        }
                      }}
                      className="font-mono cursor-pointer bg-blue-50 border-blue-700 text-blue-700 rounded-full px-2"
                    >
                      {r.id}
                    </button>
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    {getNameOrEmail(r.data) && (
                      <span>{getNameOrEmail(r.data)}</span>
                    )}
                  </div>
                ))}
              </div>
            );
            const placeholder = document.createElement("div");
            render(content, placeholder);
            popup.setLngLat(e.lngLat).setDOMContent(placeholder).addTo(map);
          };
          map.on("mouseover", layer.id, overListener);
          map.on("mouseout", layer.id, outListener);
          // @ts-ignore
          map.on("click", layer.id, clickListener);
          return () => {
            map.off("mouseover", layer.id, overListener);
            map.on("mouseout", layer.id, outListener);
            // @ts-ignore
            map.off("click", layer.id, clickListener);
            popup.remove();
          };
        }
      }, 200);
    }
  }, [
    essentials.mapContext.manager?.map,
    essentials.mapContext.ready,
    selectedQuestion,
  ]);

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
    let dataSources: DataSourceDetailsFragment[] = [];
    let layers: DataLayerDetailsFragment[] = [];
    if (selectedQuestion) {
      const element = spatialQuestions.find(
        (el) => el.exportId === selectedQuestion
      )!;
      // eslint-disable-next-line i18next/no-literal-string
      const dataSourceId = `${selectedQuestion}-source`;
      const manager = essentials.mapContext.manager;
      if (manager && essentials.mapContext.ready) {
        setTimeout(() => {
          manager.addSource(dataSourceId, {
            id: dataSourceId,
            type: "vector",
            tiles: [
              `${process.env.REACT_APP_GRAPHQL_ENDPOINT!.replace(
                "/graphql",
                // eslint-disable-next-line i18next/no-literal-string
                `/export-survey/${surveyId}/spatial/${element.id}/tiles/{z}/{x}/{y}.pbf?cacheBuster=${mapTileCacheBuster}`
              )}`,
            ],
          });
          essentials.mapContext.manager?.addLayer({
            id: dataSourceId + "-fill",
            type: "fill",
            layout: {},
            "source-layer": "sketches",
            paint: {
              "fill-color": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                "#111099",
                "#881011",
              ],
              // "fill-opacity": 0.15,
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                0.5,
                0.15,
              ],
              "fill-antialias": true,
            },
            filter: getFilter(filter),
          });
        }, 5000);
        return () => {};
      }
      //   ,
      //   {
      //     type: "line",
      //     layout: {},
      //     "source-layer": "sketches",
      //     paint: {
      //       "line-opacity": [
      //         "case",
      //         ["boolean", ["feature-state", "selected"], false],
      //         1,
      //         0.1,
      //       ],
      //       "line-color": [
      //         "case",
      //         ["boolean", ["feature-state", "selected"], false],
      //         "blue",
      //         "red",
      //       ],
      //     },
      //     filter: getFilter(filter),
      //   },
      //   {
      //     type: "circle",
      //     "source-layer": "sketches",
      //     paint: {
      //       // Make circles larger as the user zooms from z12 to z22.
      //       "circle-radius": {
      //         base: 3,
      //         stops: [
      //           [12, 3],
      //           [22, 180],
      //         ],
      //       },
      //       "circle-color": [
      //         "case",
      //         ["boolean", ["feature-state", "selected"], false],
      //         "blue",
      //         "red",
      //       ],
      //     },
      //     filter: getFilter(filter),
      //   }
      // );
      // layers.push({
      //   // eslint-disable-next-line i18next/no-literal-string
      //   dataSourceId,
      //   id: selectedQuestion,
      //   renderUnder: RenderUnderType.Labels,
      //   zIndex: 1,
      //   mapboxGlStyles: [
      //     {
      //       type: "fill",
      //       layout: {},
      //       "source-layer": "sketches",
      //       paint: {
      //         "fill-color": [
      //           "case",
      //           ["boolean", ["feature-state", "selected"], false],
      //           "#111099",
      //           "#881011",
      //         ],
      //         // "fill-opacity": 0.15,
      //         "fill-opacity": [
      //           "case",
      //           ["boolean", ["feature-state", "selected"], false],
      //           0.5,
      //           0.15,
      //         ],
      //         "fill-antialias": true,
      //       },
      //       filter: getFilter(filter),
      //     },
      //     {
      //       type: "line",
      //       layout: {},
      //       "source-layer": "sketches",
      //       paint: {
      //         "line-opacity": [
      //           "case",
      //           ["boolean", ["feature-state", "selected"], false],
      //           1,
      //           0.1,
      //         ],
      //         "line-color": [
      //           "case",
      //           ["boolean", ["feature-state", "selected"], false],
      //           "blue",
      //           "red",
      //         ],
      //       },
      //       filter: getFilter(filter),
      //     },
      //     {
      //       type: "circle",
      //       "source-layer": "sketches",
      //       paint: {
      //         // Make circles larger as the user zooms from z12 to z22.
      //         "circle-radius": {
      //           base: 3,
      //           stops: [
      //             [12, 3],
      //             [22, 180],
      //           ],
      //         },
      //         "circle-color": [
      //           "case",
      //           ["boolean", ["feature-state", "selected"], false],
      //           "blue",
      //           "red",
      //         ],
      //       },
      //       filter: getFilter(filter),
      //     },
      //   ],
      // });
    }
    // essentials.mapContext.manager?.reset(dataSources, layers);
    // if (selectedQuestion) {
    //   essentials.mapContext.manager?.setVisibleLayers([selectedQuestion!]);
    // } else {
    //   essentials.mapContext.manager?.setVisibleLayers([]);
    // }
  }, [
    selectedQuestion,
    mapTileCacheBuster,
    essentials.mapContext.manager,
    spatialQuestions,
    surveyId,
    filter,
    essentials.mapContext.ready,
  ]);

  return (
    <MapContext.Provider value={essentials.mapContext}>
      <MiniBasemapSelector basemaps={essentials.basemaps} />
      <MapboxMap
        className="w-full h-full"
        initOptions={{
          // @ts-ignore
          transformRequest: (url, resourceType, etc) => {
            if (
              new URL(url).host ===
                new URL(process.env.REACT_APP_GRAPHQL_ENDPOINT!).host &&
              token
            ) {
              const Url = new URL(url);
              Url.searchParams.set("token", token);
              return {
                url: Url.toString(),
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
