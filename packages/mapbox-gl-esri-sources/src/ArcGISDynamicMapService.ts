import {
  Map,
  ImageSource,
  RasterSource,
  AnyLayer,
  AnySourceData,
  ImageSourceOptions,
  ImageSourceRaw,
  LngLatBounds,
} from "mapbox-gl";
import {
  ComputedMetadata,
  CustomGLSource,
  CustomGLSourceOptions,
  CustomSourceType,
  DynamicRenderingSupportOptions,
  LegendItem,
  OrderedLayerSettings,
} from "./CustomGLSource";
import { v4 as uuid } from "uuid";
import { ArcGISRESTServiceRequestManager } from "./ArcGISRESTServiceRequestManager";
import { LayersMetadata, MapServiceMetadata } from "./ServiceMetadata";
import {
  contentOrFalse,
  extentToLatLngBounds,
  generateMetadataForLayer,
  makeLegend,
} from "./utils";

/** @hidden */
export const blankDataUri =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export interface ArcGISDynamicMapServiceOptions extends CustomGLSourceOptions {
  /**
   * URL for the service. Should end in /MapServer
   */
  url: string;
  /**
   * Fetch larger images for high-resolution devices.
   * @default true
   * */
  supportHighDpiDisplays?: boolean;
  /**
   * List of sublayers to display, in order. Order will be respected  only if
   * `supportsDynamicRendering` is true. If left undefined the service will be
   * with the default layers.
   * */
  layers?: OrderedLayerSettings;
  /**
   * All query parameters will be added to each MapServer export request,
   * overriding any settings made by this library. Useful for specifying image
   * format, or working with temporal data.
   * */
  queryParameters?: {
    [queryString: string]: string | number;
  };
  /**
   * Request tiles instead of a single image.
   * @default false
   */
  useTiles?: boolean;
  /**
   * 256 or 512 would be most appropriate. default is 256
   */
  tileSize?: number;
  token?: string;
}

export class ArcGISDynamicMapService
  implements CustomGLSource<ArcGISDynamicMapServiceOptions, LegendItem[]>
{
  /** Source id used in the map style */
  sourceId: string;
  private map?: Map;
  private requestManager: ArcGISRESTServiceRequestManager;
  private serviceMetadata?: MapServiceMetadata;
  private layerMetadata?: LayersMetadata;
  private options: ArcGISDynamicMapServiceOptions;

  private layers?: OrderedLayerSettings;
  private supportsDynamicLayers = false;
  private debounceTimeout?: NodeJS.Timeout;
  private _loading = true;
  private resolution?: string;
  type: CustomSourceType;
  url: string;

  /**
   * @param {string} sourceId ID to be used when adding refering to this source from layers
   * @param {string} baseUrl Location of the service. Should end in /MapServer
   * @param {ArcGISDynamicMapServiceOptions} [options]
   */
  constructor(
    requestManager: ArcGISRESTServiceRequestManager,
    options: ArcGISDynamicMapServiceOptions
  ) {
    this.type = "ArcGISDynamicMapService";
    this.options = options;
    this.url = options.url;
    this.requestManager = requestManager;
    this.sourceId = options?.sourceId || uuid();
    // remove trailing slash if present
    options.url = options.url.replace(/\/$/, "");
    if (!/rest\/services/.test(options.url) || !/MapServer/.test(options.url)) {
      throw new Error("Invalid ArcGIS REST Service URL");
    }
    this.resolution = `(resolution: ${window.devicePixelRatio}dppx)`;
    matchMedia(this.resolution).addListener(this.respondToResolutionChange);
  }

  private respondToResolutionChange = () => {
    if (this.options.supportHighDpiDisplays) {
      this.updateSource();
    }
    if (this.resolution) {
      matchMedia(this.resolution).removeListener(
        this.respondToResolutionChange
      );
    }
    this.resolution = `(resolution: ${window.devicePixelRatio}dppx)`;
    matchMedia(this.resolution).addListener(this.respondToResolutionChange);
  };

  /**
   * Use ArcGISRESTServiceRequestManager to fetch metadata for the service,
   * caching it on the instance for reuse.
   */
  private getMetadata() {
    if (this.serviceMetadata && this.layerMetadata) {
      return Promise.resolve({
        serviceMetadata: this.serviceMetadata,
        layers: this.layerMetadata,
      });
    } else {
      return this.requestManager
        .getMapServiceMetadata(this.options.url, {
          token: this.options.token,
        })
        .then(({ serviceMetadata, layers }) => {
          this.serviceMetadata = serviceMetadata;
          this.layerMetadata = layers;
          this.supportsDynamicLayers = serviceMetadata.supportsDynamicLayers;
          return { serviceMetadata, layers };
        });
    }
  }

  _computedMetadata?: ComputedMetadata;

  /**
   * Returns computed metadata for the service, including bounds, minzoom, maxzoom, and attribution.
   * @returns ComputedMetadata
   * @throws Error if metadata is not available
   * @throws Error if tileInfo is not available
   * */
  async getComputedMetadata(): Promise<ComputedMetadata> {
    if (!this._computedMetadata) {
      const { serviceMetadata, layers } = await this.getMetadata();
      const { bounds, minzoom, maxzoom, attribution } =
        await this.getComputedProperties();
      const results = /\/.+\/MapServer/.exec(this.options.url);
      let label = results ? results[0] : false;
      if (!label) {
        if (this.layerMetadata?.layers?.[0]) {
          label = this.layerMetadata.layers[0].name;
        }
      }
      const legendData = await this.requestManager.getLegendMetadata(
        this.options.url
      );

      // find hidden layers
      // Not as simple as just reading the defaultVisibility property, because
      // if a parent layer is hidden, all children are hidden as well. Folders can
      // be nested arbitrarily deep.
      const hiddenIds = new Set<number>();
      for (const layer of layers.layers) {
        if (!layer.defaultVisibility) {
          hiddenIds.add(layer.id);
        } else {
          // check if parents are hidden
          if (layer.parentLayer) {
            if (hiddenIds.has(layer.parentLayer.id)) {
              hiddenIds.add(layer.id);
            } else {
              // may not be added yet
              const parent = layers.layers.find(
                (l) => l.id === layer.parentLayer?.id
              );
              if (parent && !parent.defaultVisibility) {
                hiddenIds.add(layer.id);
                hiddenIds.add(parent.id);
              }
            }
          }
        }
      }

      this._computedMetadata = {
        bounds: bounds || undefined,
        minzoom,
        maxzoom,
        attribution,
        tableOfContentsItems: layers.layers.map((lyr) => {
          const legendLayer = legendData.layers.find(
            (l) => l.layerId === lyr.id
          );
          const isFolder = lyr.type === "Group Layer";
          if (isFolder) {
            return {
              type: "folder",
              id: lyr.id.toString(),
              label: lyr.name,
              defaultVisibility: hiddenIds.has(lyr.id)
                ? false
                : lyr.defaultVisibility,
              parentId: lyr.parentLayer
                ? lyr.parentLayer.id.toString()
                : undefined,
            };
          } else {
            return {
              type: "data",
              id: lyr.id.toString(),
              label: lyr.name,
              defaultVisibility: hiddenIds.has(lyr.id)
                ? false
                : lyr.defaultVisibility,
              metadata: generateMetadataForLayer(
                this.options.url + "/" + lyr.id,
                this.serviceMetadata!,
                lyr
              ),
              parentId: lyr.parentLayer
                ? lyr.parentLayer.id.toString()
                : undefined,
              legend: makeLegend(legendData, lyr.id),
            };
          }
        }),
        supportsDynamicRendering: {
          layerOpacity: this.supportsDynamicLayers,
          layerOrder: true,
          layerVisibility: true,
        },
      };
    }
    return this._computedMetadata!;
  }

  /**
   * Private method used as the basis for getComputedMetadata and also used
   * when generating the source data for addToMap.
   * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
   */
  private async getComputedProperties() {
    const { serviceMetadata, layers } = await this.getMetadata();
    const levels = serviceMetadata.tileInfo?.lods.map((l) => l.level) || [];
    const attribution =
      contentOrFalse(layers.layers[0].copyrightText) ||
      contentOrFalse(serviceMetadata.copyrightText) ||
      contentOrFalse(serviceMetadata.documentInfo?.Author) ||
      undefined;
    const minzoom = Math.min(...levels);
    const maxzoom = Math.max(...levels);
    return {
      minzoom,
      maxzoom,
      bounds: await extentToLatLngBounds(serviceMetadata.fullExtent),
      attribution,
    };
  }

  private onMapData = (event: mapboxgl.MapDataEvent & mapboxgl.EventData) => {
    if (event.sourceId && event.sourceId === this.sourceId) {
      this._loading = false;
    }
  };

  private onMapError = (event: mapboxgl.ErrorEvent & mapboxgl.EventData) => {
    if (
      event.sourceId === this.sourceId &&
      ((event.dataType === "source" && event.sourceDataType === "content") ||
        (event.type === "error" &&
          event.error &&
          "status" in event.error &&
          event.error.status !== 404))
    ) {
      this._loading = false;
    }
  };

  async getGLSource(map: Map): Promise<AnySourceData> {
    let { attribution, bounds } = await this.getComputedProperties();
    bounds = bounds || [-89, -179, 89, 179];
    if (this.options.useTiles) {
      return {
        type: "raster",
        tiles: [this.getUrl(map)],
        tileSize: this.options.tileSize || 256,
        bounds: bounds as [number, number, number, number] | undefined,
        attribution,
      };
    } else {
      const coordinates = this.getCoordinates(map);
      // return a blank image until map event listeners are setup
      const url = this.getUrl(map);
      console.log("initializing with this url", url);
      return {
        type: "image",
        url,
        coordinates,
      } as ImageSourceRaw;
    }
  }

  private getCoordinates(map: Map) {
    const bounds = map.getBounds();
    // bbox's rubbing up against max extents appear to cause exceptions
    // to be repeatedly thrown in mapbox-gl in globe projection
    // TODO: this might be better solved by limiting image to the max
    // bounds of the dataset returned by the service
    const coordinates = [
      [
        Math.max(bounds.getNorthWest().lng, -179),
        Math.min(bounds.getNorthWest().lat, 89),
      ],
      [
        Math.min(bounds.getNorthEast().lng, 179),
        Math.min(bounds.getNorthEast().lat, 89),
      ],
      [
        Math.min(bounds.getSouthEast().lng, 179),
        Math.max(bounds.getSouthEast().lat, -89),
      ],
      [
        Math.max(bounds.getSouthWest().lng, -179),
        Math.max(bounds.getSouthWest().lat, -89),
      ],
    ];
    console.log(coordinates.join(","));
    return coordinates;
  }

  async addToMap(map: Map) {
    if (!map) {
      throw new Error("Map not provided to addToMap");
    }
    const sourceData = await this.getGLSource(map);
    map.addSource(this.sourceId, sourceData);
    this.addEventListeners(map);
    return this.sourceId;
  }

  addEventListeners(map: Map) {
    if (!map) {
      throw new Error("Map not provided to addEventListeners");
    }
    if (!this.options?.useTiles) {
      if (!this.map || (this.map && this.map !== map)) {
        if (this.map) {
          this.removeEventListeners(this.map);
        }
        this.map = map;
        map.on("moveend", this.updateSource);
        map.on("data", this.onMapData);
        map.on("error", this.onMapError);
        // Source is added as a blank image at first. Initialize it with
        // proper bounds and image
        // this.updateSource();
      }
    }
  }

  removeEventListeners(map: Map) {
    if (!this.map) {
      throw new Error("Map not set");
    } else if (this.map !== map) {
      throw new Error("Map does not match");
    }
    delete this.map;
    map.off("moveend", this.updateSource);
    map.off("data", this.onMapData);
    map.off("error", this.onMapError);
  }

  removeFromMap(map: Map) {
    if (map.getSource(this.sourceId)) {
      const layers = map.getStyle().layers || [];
      for (const layer of layers) {
        if ("source" in layer && layer.source === this.sourceId) {
          map.removeLayer(layer.id);
        }
      }
      this.removeEventListeners(map);
      map.removeSource(this.sourceId);
      this.map = undefined;
    }
  }

  /**
   * Clears all map event listeners setup by this instance.
   */
  destroy() {
    matchMedia(this.resolution!).removeListener(this.respondToResolutionChange);
    if (this.map) {
      this.removeFromMap(this.map);
    }
  }

  private getUrl(map?: Map) {
    map = this.map || map;
    if (!map) {
      return blankDataUri;
    }
    let url = new URL(this.options.url + "/export");
    url.searchParams.set("f", "image");
    url.searchParams.set("transparent", "true");
    // create bbox in web mercator
    const coordinates = this.getCoordinates(map);
    let bbox = [
      lon2meters(coordinates[0][0]),
      lat2meters(coordinates[2][1]),
      lon2meters(coordinates[2][0]),
      lat2meters(coordinates[0][1]),
    ];
    const groundResolution = getGroundResolution(
      map.getZoom() +
        (this.options.supportHighDpiDisplays ? window.devicePixelRatio - 1 : 0)
    );
    // Width and height can't be based on container width if the map is rotated
    const width = Math.round((bbox[2] - bbox[0]) / groundResolution);
    const height = Math.round((bbox[3] - bbox[1]) / groundResolution);

    url.searchParams.set("format", "png");
    url.searchParams.set("size", [width, height].join(","));
    if (this.options.supportHighDpiDisplays) {
      switch (window.devicePixelRatio) {
        case 1:
          // standard pixelRatio looks best at 96
          url.searchParams.set("dpi", "96");
          break;
        case 2:
          // for higher pixelRatios, esri's software seems to like the dpi
          // bumped up somewhat higher than a simple formula would suggest
          url.searchParams.set("dpi", "220");
          break;
        case 3:
          url.searchParams.set("dpi", "390");
          break;
        default:
          url.searchParams.set(
            "dpi",
            // Bumping pixel ratio a bit. see above
            (window.devicePixelRatio * 96 * 1.22).toString()
          );
          break;
      }
    } else {
      url.searchParams.set("dpi", "96");
    }
    // Default to epsg:3857
    url.searchParams.set("imageSR", "102100");
    url.searchParams.set("bboxSR", "102100");
    // If the map extent crosses the meridian, we need to create a new
    // projection and map the x coordinates to that space. The Esri JS API
    // exhibits this same behavior. Solution was inspired by:
    // * https://github.com/Esri/esri-leaflet/issues/672#issuecomment-160691149
    // * https://gist.github.com/perrygeo/4478844
    if (Math.abs(bbox[0]) > 20037508.34 || Math.abs(bbox[2]) > 20037508.34) {
      const centralMeridian = this.map?.getCenter().lng;
      if (this.options.supportHighDpiDisplays && window.devicePixelRatio > 1) {
        bbox[0] = -(width * groundResolution) / (window.devicePixelRatio * 2);
        bbox[2] = (width * groundResolution) / (window.devicePixelRatio * 2);
      } else {
        bbox[0] = -(width * groundResolution) / 2;
        bbox[2] = (width * groundResolution) / 2;
      }
      const sr = JSON.stringify({
        wkt: `PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",${centralMeridian}],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]`,
      });
      url.searchParams.set("imageSR", sr);
      url.searchParams.set("bboxSR", sr);
    }

    if (Array.isArray(this.layers)) {
      if (this.layers.length === 0) {
        return blankDataUri;
      } else {
        url.searchParams.set(
          "layers",
          `show:${this.layers.map((lyr) => lyr.id).join(",")}`
        );
      }
    }

    url.searchParams.set("bbox", bbox.join(","));

    url.searchParams.delete("dynamicLayers");
    let layersInOrder = true;
    let hasOpacityUpdates = false;
    if (this.supportsDynamicLayers && this.layers) {
      for (var i = 0; i < this.layers.length; i++) {
        if (
          this.layers[i - 1] &&
          parseInt(this.layers[i].id) < parseInt(this.layers[i - 1].id)
        ) {
          layersInOrder = false;
        }
        const opacity = this.layers[i].opacity;
        if (opacity !== undefined && opacity < 1) {
          hasOpacityUpdates = true;
        }
      }
    }
    if (this.layers && (!layersInOrder || hasOpacityUpdates)) {
      // need to provide renderInfo
      const dynamicLayers = this.layers.map((lyr) => {
        return {
          id: lyr.id,
          source: {
            mapLayerId: lyr.id,
            type: "mapLayer",
          },
          drawingInfo: {
            transparency:
              lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
          },
        };
      });
      url.searchParams.set("dynamicLayers", JSON.stringify(dynamicLayers));
    }
    for (const key in this.options.queryParameters) {
      url.searchParams.set(key, this.options.queryParameters[key].toString());
    }
    const tileSize = this.options.tileSize || 256;
    if (this.options.useTiles) {
      url.searchParams.set("bbox", `seasketch-replace-me`);
      if (this.options.supportHighDpiDisplays && window.devicePixelRatio > 1) {
        const size = tileSize * window.devicePixelRatio;
        url.searchParams.set("size", [size, size].join(","));
      } else {
        url.searchParams.set("size", [tileSize, tileSize].join(","));
      }
    }
    return url.toString().replace("seasketch-replace-me", "{bbox-epsg-3857}");
  }

  /** Whether a source image is currently being fetched over the network */
  get loading(): boolean {
    const source = this.map?.getSource(this.sourceId);
    if (source && source.type === "raster") {
      return this.map!.isSourceLoaded(this.sourceId) === false;
    } else {
      return this._loading;
    }
  }

  private updateSource = () => {
    this._loading = true;
    const source = this.map?.getSource(this.sourceId);
    if (source && this.map) {
      if (source.type === "raster") {
        // @ts-ignore - setTiles is in fact a valid method
        source.setTiles([this.getUrl()]);
      } else if (source.type === "image") {
        const coordinates = this.getCoordinates(this.map);

        const url = this.getUrl(this.map);
        // @ts-ignore
        const currentUrl = source.url;
        if (currentUrl === url) {
          console.log("skipping, urls match", currentUrl, url);
          return;
        }
        // @ts-ignore Using a private member here
        console.log("updating image", url, source);
        // @ts-ignore
        if (source.url === url) {
          return;
        }
        source.updateImage({
          url,
          coordinates,
        });
      } else {
        // do nothing, source isn't added
      }
    }
  };

  private debouncedUpdateSource = () => {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(() => {
      delete this.debounceTimeout;
      this.updateSource();
    }, 5);
  };

  /**
   * Update the list of sublayers and re-render the the map. If
   * `supportsDynamicLayers` is enabled, sublayer order and opacity will be
   * respected.
   *
   * ```typescript
   * // reverses layer rendering order and sets one sublayer to 50% transparency
   * mapService.updateLayers([
   *   { sublayer: 1, opacity: 0.5 },
   *   { sublayer: 0, opacity: 1 }
   * ]);
   * ```
   *
   * @param layers SublayerState is an array of objects with `sublayer` and
   *               optional `opacity` props.
   *
   */
  updateLayers(layers: OrderedLayerSettings) {
    console.log("update layers", layers);
    // do a deep comparison of layers to detect whether there are any changes
    if (JSON.stringify(layers) !== JSON.stringify(this.layers)) {
      this.layers = layers;
      this.debouncedUpdateSource();
    }
  }

  /**
   * Update query params sent with each export request and re-render the map. A
   * list of supported parameters can be found in the [Esri REST API docs](https://developers.arcgis.com/rest/services-reference/export-map.htm#GUID-C93E8957-99FD-473B-B0E1-68EA315EBD98).
   * Query parameters will override any values set by this library, such as
   * `format`, `dpi`, `size`, and `bbox`.
   *
   * ```typescript
   *
   * mapServiceSource.updateQueryParameters({
   *  format: 'png32',
   *  // visualize temporal datasets!
   *  historicMoment: slider.value
   * })
   *
   * ```
   */
  updateQueryParameters(queryParameters: {
    [queryString: string]: string | number;
  }) {
    // do a deep comparison of layers to detect whether there are any changes
    if (
      JSON.stringify(this.options.queryParameters) !==
      JSON.stringify(queryParameters)
    ) {
      this.options.queryParameters = queryParameters;
      this.debouncedUpdateSource();
    }
  }

  /**
   * Update support for adjusting image resolution based on devicePixelRatio and
   * re-render the map. Useful for giving users the option to toggle
   * high-resolution images depending on network conditions.
   * @param enable
   */
  updateUseDevicePixelRatio(enable: boolean) {
    if (enable !== this.options.supportHighDpiDisplays) {
      this.options.supportHighDpiDisplays = enable;
      this.debouncedUpdateSource();
    }
  }

  async getGLStyleLayers() {
    return {
      layers: [
        {
          id: uuid(),
          type: "raster",
          source: this.sourceId,
          paint: {
            "raster-fade-duration": this.options.useTiles ? 300 : 0,
          },
        },
      ] as AnyLayer[],
    };
  }

  get ready() {
    return Boolean(this._computedMetadata);
  }

  async prepare() {
    await this.getComputedMetadata();
    return;
  }
}

/** @hidden */
function lat2meters(lat: number) {
  // thanks! https://gist.github.com/onderaltintas/6649521
  var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  return (y * 20037508.34) / 180;
}

/** @hidden */
function lon2meters(lon: number) {
  return (lon * 20037508.34) / 180;
}

/** @hidden */
function getGroundResolution(level: number) {
  let groundResolution = resolutions[level];
  if (!groundResolution) {
    groundResolution = (2 * Math.PI * 6378137) / (256 * 2 ** (level + 1));
    resolutions[level] = groundResolution;
  }
  return groundResolution;
}

/** @hidden */
const resolutions: { [level: number]: number } = {};
