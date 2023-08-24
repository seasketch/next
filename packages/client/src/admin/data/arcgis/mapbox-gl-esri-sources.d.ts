declare module "mapbox-gl-esri-sources" {
  import { Map, RasterSource } from "mapbox-gl";
  export interface EsriServiceOptions {
    url: string;
    fetchOptions?: RequestInit;
    layers?: string[];
    format?: string;
    transparent?: boolean;
    layerDefs?: { [id: number]: string };
    from?: Date;
    to?: Date;
    getAttributionFromService?: boolean;
  }
  export interface TiledMapServiceEsriServiceOptions {
    url: string;
    fetchOptions?: RequestInit;
  }

  export class DynamicMapService {
    constructor(
      id: string,
      map: Map,
      esriServiceOptions: EsriServiceOptions,
      rasterSourceOptions?: Partial<RasterSource>
    );
    /* Returns a promise which when resolved returns the service metadata as a json object. */
    getMetadata(): Promise<any>;
    /* 	Returns a promise which when resolved returns the features as an esri-json object. By default the geometry is not returned. */
    identify(
      latLon: { lng: number; lat: number },
      returnGeometry: boolean
    ): Promise<any>;
    /* Redraws the layer with the new layer definitions. Corresponds to the option above on the Esri Service Options. */
    setLayerDefs(layerDefs: { [id: number]: string }): void;
    /* 	Redraws the layer to show the passed array of layer ids. */
    setLayers(layers: string[]): void;
    /* Redraws the layer with he passed time range. */
    setDates(from: Date, to: Date): void;
    /**
     * Sets the attribution on the map from the service metadata. This happens automatically if the getAttributionFromService option is true.
     */
    setAttributionFromService(getAttributionFromService: boolean): void;
  }

  export class TiledMapService {
    constructor(
      id: string,
      map: Map,
      esriServiceOptions: TiledMapServiceEsriServiceOptions,
      rasterSourceOptions?: Partial<RasterSource>
    );
  }
}
