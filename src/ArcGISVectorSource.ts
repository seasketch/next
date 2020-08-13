import {
  Map,
  LngLatBounds,
  AnySourceImpl,
  ImageSource,
  GeoJSONSource,
} from "mapbox-gl";
import { FeatureCollection } from "geojson";

const WORLD = { xmin: -180, xmax: 180, ymin: -90, ymax: 90 };

type ArcGISVectorSourceStrategy = "geojson" | "vector";

export class ArcGISVectorSource {
  protected data = {
    type: "FeatureCollection",
    features: [],
  } as FeatureCollection;
  protected id: string;
  protected baseUrl: string;
  private options:
    | undefined
    | {
        strategy?: ArcGISVectorSourceStrategy;
        bytesLimit?: number;
        geometryPrecision?: number;
      };
  protected map: Map;
  protected totalBytes = 0;
  protected outFields = "*";
  protected source: GeoJSONSource;
  protected supportsPagination = true;

  constructor(
    map: Map,
    id: string,
    url: string,
    options?: {
      strategy?: ArcGISVectorSourceStrategy;
      bytesLimit?: number;
      geometryPrecision?: number;
      supportsPagination?: boolean;
    }
  ) {
    this.id = id;
    this.baseUrl = url;
    this.options = options;
    this.map = map;
    this.map.addSource(this.id, {
      data: this.data,
      type: this.options?.strategy || "geojson",
    });
    if (
      options &&
      "supportsPagination" in options &&
      options["supportsPagination"] === false
    ) {
      this.supportsPagination = false;
    }
    this.source = this.map.getSource(this.id) as GeoJSONSource;
    if ((this.options?.strategy || "geojson") === "geojson") {
      this.fetchGeoJSON();
    }
  }

  private async fetchGeoJSON() {
    if (this.options?.bytesLimit && this.options.bytesLimit < this.totalBytes) {
      throw new Error("Exceeded data transfer limit for this source");
    }
    const params = new URLSearchParams({
      inSR: "4326",
      geometry: JSON.stringify(WORLD),
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      outFields: this.outFields,
      returnGeometry: "true",
      geometryPrecision: this.options?.geometryPrecision?.toString() || "6",
      returnIdsOnly: "false",
      f: "geojson",
      resultOffset: this.supportsPagination
        ? this.data.features.length.toString()
        : "",
    });
    const response = await fetch(`${this.baseUrl}/query?${params.toString()}`, {
      mode: "cors",
    });
    this.totalBytes += parseInt(response.headers.get("content-length") || "0");
    const featureCollection = await response.json();
    if (featureCollection.error) {
      if (
        this.supportsPagination &&
        /pagination/i.test(featureCollection.error.message)
      ) {
        this.supportsPagination = false;
        this.fetchGeoJSON();
      } else {
        throw new Error(
          `Error retrieving feature data. ${featureCollection.error.message}`
        );
      }
    } else {
      this.data = {
        type: "FeatureCollection",
        features: [...this.data.features, ...featureCollection.features],
      };
      this.source.setData(this.data);
      if (featureCollection.exceededTransferLimit) {
        if (this.supportsPagination === false) {
          throw new Error(
            "Data source does not support pagination but exceeds transfer limit"
          );
        } else {
          this.fetchGeoJSON();
        }
      }
    }
  }
}
