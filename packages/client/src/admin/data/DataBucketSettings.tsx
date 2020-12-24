import React, { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import mapboxgl, { AnySourceData, GeoJSONSource, Map, Source } from "mapbox-gl";
import {
  useProjectBucketSettingQuery,
  useUpdateProjectStorageBucketMutation,
} from "../../generated/graphql";
import { Feature, Point, FeatureCollection } from "geojson";
import Spinner from "../../components/Spinner";

function DataBucketSettings(props: { className?: string }) {
  const { t, i18n } = useTranslation(["admin"]);
  const [map, setMap] = useState<Map | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const { slug } = useParams<{ slug: string }>();
  const [region, setRegion] = useState("");
  const buckets = useProjectBucketSettingQuery({
    variables: { slug },
  });
  const projectBucketSetting =
    buckets.data?.projectBySlug?.dataSourcesBucket?.bucket || "";
  const [
    mutate,
    { data, error, loading },
  ] = useUpdateProjectStorageBucketMutation();

  useEffect(() => {
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;
    if (!map && mapContainer.current) {
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/underbluewaters/ckhgrw8pq0n2j19ldoa5z1d72", // stylesheet location
        center: [17, 19.8],
        zoom: 0.026,
        maxZoom: 0.725,
      });

      mapInstance.on("load", () => {
        setMap(mapInstance);

        // when mode drawing should be activated
        // draw.changeMode("draw_rectangle", {});
        mapInstance.resize();
        // @ts-ignore
      });
    }
  }, [map, mapContainer.current]);

  useEffect(() => {
    if (projectBucketSetting) {
      setRegion(projectBucketSetting);
    }
    if (
      map &&
      buckets.data?.projectBySlug?.dataSourcesBucket &&
      map.getSource("selected-region")
    ) {
      const source = map.getSource("selected-region") as GeoJSONSource;
      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: JSON.parse(
              buckets.data.projectBySlug.dataSourcesBucket.location.geojson
            ),
          },
        ],
      });
    }
  }, [projectBucketSetting]);

  useEffect(() => {
    if (
      map &&
      buckets.data &&
      buckets.data.dataSourcesBucketsConnection?.nodes.length &&
      !map.getSource("data-centers")
    ) {
      const collection: FeatureCollection<Point> = {
        type: "FeatureCollection",
        features: [],
      };
      for (const bucket of buckets.data.dataSourcesBucketsConnection?.nodes ||
        []) {
        const geometry = JSON.parse(bucket.location.geojson) as Point;
        const feature = {
          id: bucket.bucket,
          type: "Feature",
          properties: {
            name: bucket.name,
            region: bucket.region,
            bucket: bucket.bucket,
          },
          geometry,
        };
        collection.features.push(feature as Feature<Point>);
      }
      if (map.getLayer("data-centers-circle")) {
        map.removeLayer("data-centers-circle");
        map.removeLayer("data-center-label");
        map.removeSource("data-centers");
      }
      map.addSource("selected-region", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: JSON.parse(
                buckets.data.projectBySlug!.dataSourcesBucket!.location.geojson
              ),
            },
          ],
        },
      });
      map.addSource("data-centers", {
        type: "geojson",
        data: collection,
        attribution:
          '© <a href="https://github.com/telegeography/www.submarinecablemap.com">submarinecablemap.com</a> (CC BY-NC-SA 3.0)',
      });
      map.addLayer({
        id: "selected-region-circle",
        type: "circle",
        paint: {
          "circle-color": "yellow",
          "circle-radius": 18,
          // "circle-stroke-width": 1,
          // "circle-stroke-color": "yellow",
          "circle-blur": 1,
        },
        source: "selected-region",
      });
      map.addLayer({
        id: "data-centers-circle",
        type: "circle",
        paint: {
          "circle-color": "orange",
          "circle-radius": 5,
          "circle-stroke-width": 1,
          "circle-stroke-color": "black",
        },
        source: "data-centers",
      });
      map.addLayer({
        id: "data-center-label",
        type: "symbol",
        source: "data-centers",
        layout: {
          "text-field": "{name}",
          "text-size": 13,
          "text-ignore-placement": true,
          "text-anchor": "bottom-left",
          "text-offset": [0.25, -0.25],
        },
        paint: {
          "text-color": "white",
          "text-halo-width": 2,
          "text-halo-color": "rgba(0,0,0,0.5)",
        },
      });
      // @ts-ignore
      window.map = map;
    }
  }, [map, buckets.data]);

  // useEffect(() => {
  //   if (data && map && draw && draw.getAll().features.length === 0) {
  //     const feature = {
  //       type: "Feature",
  //       id: 1,
  //       properties: {},
  //       geometry: JSON.parse(data.projectBySlug?.region.geojson),
  //     };
  //     draw.add(feature);
  //     draw.changeMode("static");
  //     const box = bbox(feature);
  //     map.fitBounds(
  //       [
  //         [box[0], box[1]],
  //         [box[2], box[3]],
  //       ],
  //       { padding: 20, duration: 0 }
  //     );
  //     // zoomToFeature(feature, map);
  //     draw.changeMode("static");
  //     setDrawing(false);
  //   }
  // }, [data, map, draw]);

  return (
    <>
      <div className={`mt-5 relative ${props.className}`}>
        <div className="shadow sm:rounded-md sm:overflow-hidden">
          <div className="px-4 py-5 bg-white sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {t("Data Storage Location")}
            </h3>
            {/* {mutationState.error && <p>{mutationState.error.message}</p>} */}
            <p className="mt-1 text-sm leading-5 text-gray-500">
              <Trans ns="admin">
                Choose a location where you want SeaSketch to store imported map
                data. It's best to pick a data center close to your users for
                best performance.
              </Trans>
            </p>
            <div>
              <form className="relative w-96">
                <select
                  id="location"
                  onChange={(e) => {
                    setRegion(e.target.value);
                    mutate({
                      variables: {
                        slug: slug,
                        bucket: e.target.value,
                      },
                    });
                  }}
                  value={region}
                  className="mt-1 form-select w-80 pl-3 pr-10 py-2 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 rounded-md focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5"
                >
                  {(
                    buckets.data?.dataSourcesBucketsConnection?.nodes || []
                  ).map((bucket) => (
                    <option
                      key={bucket.bucket}
                      value={bucket.bucket}
                      // selected={bucket.id === projectBucketSetting}
                    >
                      {bucket.name}
                    </option>
                  ))}
                </select>
                {loading && <Spinner className="absolute right-4 top-3" />}
              </form>
            </div>
            <div
              className="w-full h-72 mt-2"
              ref={(el) => (mapContainer.current = el)}
            ></div>
          </div>
        </div>
      </div>
    </>
  );
}

export default DataBucketSettings;
