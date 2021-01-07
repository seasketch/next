import { useEffect, useState } from "react";
import {
  useDataSourceUrlPropertiesQuery,
  DataSourceTypes,
} from "../../generated/graphql";
import { GeoJSON, FeatureCollection, Feature } from "geojson";

const cache: { [sourceId: number]: string[] } = {};

export default function useSourcePropertyNames(sourceId: number) {
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
        } = propsQuery.data.dataSource;
        if (type === DataSourceTypes.SeasketchVector) {
          fetch(`https://${bucketId}/${objectKey}`)
            .then((r) => r.json())
            .then((data: GeoJSON) => {
              console.log("featureCollection");
              let example: Feature;
              if (data.type === "FeatureCollection") {
                example = data.features[0];
              } else {
                example = data as Feature;
              }
              setNames(Object.keys(example.properties || {}));
            });
        }
      }
    }
  }, [propsQuery.data]);
  return names;
}
