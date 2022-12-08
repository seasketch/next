import { DrawFeature } from "@mapbox/mapbox-gl-draw";
import { Feature } from "geojson";

export async function preprocess(
  endpoint: string,
  drawFeature: any,
  changeMode: (mode: string, args?: any) => void,
  preprocessingResults?: { [id: string]: Feature<any> }
) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feature: drawFeature.toGeoJSON() }),
  }).then(async (response) => {
    if (response.ok) {
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (!preprocessingResults) {
        preprocessingResults = {};
      }
      preprocessingResults[drawFeature.id] = data.data;
      changeMode("simple_select", {
        preprocessingEndpoint: endpoint,
        preprocessingResults,
      });
    } else {
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("Unrecognized response from preprocessor");
      }
    }
  });
}
