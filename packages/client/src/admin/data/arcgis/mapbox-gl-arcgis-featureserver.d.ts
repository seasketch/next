declare module "mapbox-gl-arcgis-featureserver" {
  import { Map } from "mapbox-gl";
  import { Feature } from "geojson";
  import { GeoJSONSourceOptions } from "mapbox-gl";
  export interface ArcGISFeatureServiceOptions {
    url: string;
    useStaticZoomLevel?: boolean;
    minZoom?: number;
    simplifyFactor?: number;
    precision?: number;
    setAttributionFromService?: boolean;
    where?: string;
    outFields?: string;
    from?: Date;
    to?: Date;
    useServiceBounds?: boolean;
    projectionEndpoint?: string;
    token?: string;
  }

  export default class FeatureService {
    constructor(
      sourceId: string,
      map: Map,
      arcgisOptions: ArcGISFeatureServiceOptions,
      geojsonSourceOptions?: GeoJSONSourceOptions
    );

    serviceMetadata: any;

    destroySource(): void;
    disableRequests(): void;
    enableRequests(): void;
    getFeaturesByLatLng(
      latLng: { lng: number; lat: number },
      searchRadius?: number,
      returnGeometry?: boolean
    ): Promise<Feature[]>;
    getFeaturesByObjectIds(
      objectIds: number[],
      returnGeometry?: boolean
    ): Promise<Feature[]>;
    setWhere(where: string): void;
    clearWhere(): void;
    setDates(from: Date, to: Date): void;
    setToken(token: string): void;
  }
}
