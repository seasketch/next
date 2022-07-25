import { useEffect, useState } from "react";
import {
  useDataSourceUrlPropertiesQuery,
  DataSourceTypes,
} from "../../generated/graphql";
import { GeoJSON, Feature } from "geojson";

const cache: { [sourceId: number]: string[] } = {};

export default function useSourcePropertyNames(
  sourceId: number,
  sublayer?: string | null
) {
  const propsQuery = useDataSourceUrlPropertiesQuery({
    variables: {
      id: sourceId,
    },
  });
  const [names, setNames] = useState<string[]>(cache[sourceId] || []);
  useEffect(() => {
    if (!cache[sourceId]) {
      if (propsQuery.data?.dataSource) {
        const {
          type,
          bucketId,
          objectKey,
          url,
          originalSourceUrl,
          queryParameters,
        } = propsQuery.data.dataSource;
        if (type === DataSourceTypes.SeasketchVector) {
          fetch(`https://${bucketId}/${objectKey}`)
            .then((r) => r.json())
            .then((data: GeoJSON) => {
              let example: Feature;
              if (data.type === "FeatureCollection") {
                example = data.features[0];
              } else {
                example = data as Feature;
              }
              setNames(Object.keys(example.properties || {}));
            });
        } else if (type === DataSourceTypes.ArcgisVector) {
          fetch(`${url}?f=json`)
            .then((r) => r.json())
            .then((data: any) => {
              if (data.fields && data.fields.length) {
                let fieldNames: string[] = data.fields.map((f: any) =>
                  f.name.toString()
                );
                if (
                  queryParameters &&
                  queryParameters.outFields &&
                  queryParameters.outFields !== "*"
                ) {
                  const allowedFields = queryParameters.outFields.split(",");
                  fieldNames = fieldNames.filter(
                    (name) => allowedFields.indexOf(name) !== -1
                  );
                }
                setNames(fieldNames);
              }
            });
        } else if (type === DataSourceTypes.ArcgisDynamicMapserver) {
          fetch(`${url}/${sublayer}?f=json`)
            .then((r) => r.json())
            .then((data: any) => {
              if (data.fields && data.fields.length) {
                let fieldNames: string[] = data.fields.map((f: any) =>
                  f.name.toString()
                );
                if (
                  queryParameters &&
                  queryParameters.outFields &&
                  queryParameters.outFields !== "*"
                ) {
                  const allowedFields = queryParameters.outFields.split(",");
                  fieldNames = fieldNames.filter(
                    (name) => allowedFields.indexOf(name) !== -1
                  );
                }
                setNames(fieldNames);
              }
            });
        }
      }
    }
  }, [propsQuery.data]);
  return names;
}
