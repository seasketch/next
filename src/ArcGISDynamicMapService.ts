import { Map, LngLatBounds, AnySourceImpl, ImageSource } from "mapbox-gl";

/** @hidden */
const blankDataUri =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export interface SublayerState {
  /** 0-based sublayer index */
  sublayer: number;
  /** sublayer opacity from 0.0 - 1.0 */
  opacity?: number;
}

export interface ArcGISDynamicMapServiceOptions {
  /**
   * Fetch larger images for high-resolution devices.
   * @default true
   * */
  useDevicePixelRatio?: boolean;
  /**
   * List of sublayers to display, in order. Order will be respected  only if
   * `supportsDynamicLayers` is true. If left undefined the service will be
   * with the default layers.
   * */
  layers?: SublayerState[];
  /**
   * Set true if the Map Service supports [dynamic layers](https://developers.arcgis.com/rest/services-reference/export-map.htm#GUID-E781BA37-0260-485E-BB21-CA9B85206AAE)
   * , in which case sublayer order and opacity can be specified. If set false
   * any order and opacity settings will be ignored.
   * @default false
   * */
  supportsDynamicLayers?: boolean;
  /**
   * All query parameters will be added to each MapServer export request,
   * overriding any settings made by this library. Useful for specifying image
   * format, or working with temporal data.
   * */
  queryParameters?: {
    [queryString: string]: string | number;
  };
}

/**
 * Add an Esri Dynamic Map Service as an image source to a MapBox GL JS map, and
 * use the included methods to update visible sublayers, set layer order and
 * opacity, support high-dpi screens, and transparently deal with issues related
 * to crossing the central meridian.
 *
 * ```typescript
 * import { ArcGISDynamicMapService } from "mapbox-gl-esri-sources";
 *
 * // ... setup your map
 *
 * const populatedPlaces = new ArcGISDynamicMapService(
 *   map,
 *   "populated-places-source",
 *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer", {
 *     supportsDynamicLayers: true,
 *     sublayers: [
 *       { sublayer: 0, opacity: 1 },
 *       { sublayer: 1, opacity: 1 },
 *       { sublayer: 2, opacity: 0.5 },
 *     ],
 *     queryParameters: {
 *       format: 'png32'
 *     }
 *   }
 * });
 *
 * // Don't forget to add a layer to reference your source
 * map.addLayer({
 *   id: "ags-layer",
 *   type: "raster",
 *   source: populatedPlaces.id,
 *   paint: {
 *     "raster-fade-duration": 0,
 *     "raster-opacity": 0.9
 *   },
 * });
 *
 * // turn off the third sublayer and update opacity
 * populatedPlaces.updateLayers([
 *   { sublayer: 0, opacity: 0.5 },
 *   { sublayer: 1, opacity: 1 },
 * ]);
 *
 * // disable high-dpi screen support
 * populatedPlaces.updateUseDevicePixelRatio(false);
 * ```
 * @class ArcGISDynamicMapService
 */
export class ArcGISDynamicMapService {
  /** Source id used in the map style */
  id: string;
  private baseUrl: string;
  private url: URL;
  private map: Map;
  private layers?: SublayerState[];
  private queryParameters: { [queryString: string]: number | string };
  private source: ImageSource;
  private supportDevicePixelRatio: boolean = true;
  private supportsDynamicLayers = false;
  private debounceTimeout?: NodeJS.Timeout;

  /**
   * @param {Map} map MapBox GL JS Map instance
   * @param {string} id ID to be used when adding refering to this source from layers
   * @param {string} baseUrl Location of the service. Should end in /MapServer
   * @param {ArcGISDynamicMapServiceOptions} [options]
   */
  constructor(
    map: Map,
    id: string,
    baseUrl: string,
    options?: ArcGISDynamicMapServiceOptions
  ) {
    this.id = id;
    this.baseUrl = baseUrl;
    this.url = new URL(this.baseUrl + "/export");
    this.url.searchParams.set("f", "image");
    this.map = map;
    this.map.on("moveend", this.updateSource);
    this.layers = options?.layers;
    this.queryParameters = {
      transparent: "true",
      ...(options?.queryParameters || {}),
    };
    if (options && "useDevicePixelRatio" in options) {
      this.supportDevicePixelRatio = !!options.useDevicePixelRatio;
    }

    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addListener(
      () => {
        if (this.supportDevicePixelRatio) {
          this.updateSource();
        }
      }
    );

    this.supportsDynamicLayers = options?.supportsDynamicLayers || false;
    const bounds = this.map.getBounds();
    this.map.addSource(this.id, {
      type: "image",
      url: this.getUrl(),
      coordinates: [
        [bounds.getWest(), bounds.getNorth()],
        [bounds.getEast(), bounds.getNorth()],
        [bounds.getEast(), bounds.getSouth()],
        [bounds.getWest(), bounds.getSouth()],
      ],
    });
    this.source = this.map.getSource(this.id) as ImageSource;
  }

  /**
   * Clears all map event listeners setup by this instance.
   */
  destroy() {
    this.map.off("moveend", this.updateSource);
  }

  private getUrl() {
    const bounds = this.map.getBounds();
    // create bbox in web mercator
    let bbox = [
      lon2meters(bounds.getWest()),
      lat2meters(bounds.getSouth()),
      lon2meters(bounds.getEast()),
      lat2meters(bounds.getNorth()),
    ];
    const groundResolution = getGroundResolution(
      this.map.getZoom() +
        (this.supportDevicePixelRatio ? window.devicePixelRatio - 1 : 0)
    );
    // Width and height can't be based on container width if the map is rotated
    const width = Math.round((bbox[2] - bbox[0]) / groundResolution);
    const height = Math.round((bbox[3] - bbox[1]) / groundResolution);

    this.url.searchParams.set("format", "png");
    this.url.searchParams.set("size", [width, height].join(","));
    if (this.supportDevicePixelRatio) {
      switch (window.devicePixelRatio) {
        case 1:
          // standard pixelRatio looks best at 96
          this.url.searchParams.set("dpi", "96");
          break;
        case 2:
          // for higher pixelRatios, esri's software seems to like the dpi
          // bumped up somewhat higher than a simple formula would suggest
          this.url.searchParams.set("dpi", "220");
          break;
        case 3:
          this.url.searchParams.set("dpi", "390");
          break;
        default:
          this.url.searchParams.set(
            "dpi",
            // Bumping pixel ratio a bit. see above
            (window.devicePixelRatio * 96 * 1.22).toString()
          );
          break;
      }
    } else {
      this.url.searchParams.set("dpi", "96");
    }
    // Default to epsg:3857
    this.url.searchParams.set("imageSR", "102100");
    this.url.searchParams.set("bboxSR", "102100");
    // If the map extent crosses the meridian, we need to create a new
    // projection and map the x coordinates to that space. The Esri JS API
    // exhibits this same behavior. Solution was inspired by:
    // * https://github.com/Esri/esri-leaflet/issues/672#issuecomment-160691149
    // * https://gist.github.com/perrygeo/4478844
    if (Math.abs(bbox[0]) > 20037508.34 || Math.abs(bbox[2]) > 20037508.34) {
      const centralMeridian = bounds.getCenter().lng;
      if (this.supportDevicePixelRatio && window.devicePixelRatio > 1) {
        bbox[0] = -(width * groundResolution) / (window.devicePixelRatio * 2);
        bbox[2] = (width * groundResolution) / (window.devicePixelRatio * 2);
      } else {
        bbox[0] = -(width * groundResolution) / 2;
        bbox[2] = (width * groundResolution) / 2;
      }
      const sr = JSON.stringify({
        wkt: `PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",${centralMeridian}],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]`,
      });
      this.url.searchParams.set("imageSR", sr);
      this.url.searchParams.set("bboxSR", sr);
    }

    if (Array.isArray(this.layers)) {
      if (this.layers.length === 0) {
        return blankDataUri;
      } else {
        this.url.searchParams.set(
          "layers",
          `show:${this.layers.map((lyr) => lyr.sublayer).join(",")}`
        );
      }
    }

    this.url.searchParams.set("bbox", bbox.join(","));

    this.url.searchParams.delete("dynamicLayers");
    let layersInOrder = true;
    let hasOpacityUpdates = false;
    if (this.supportsDynamicLayers && this.layers) {
      for (var i = 0; i < this.layers.length; i++) {
        if (
          this.layers[i - 1] &&
          this.layers[i].sublayer < this.layers[i - 1].sublayer
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
          id: lyr.sublayer,
          source: {
            mapLayerId: lyr.sublayer,
            type: "mapLayer",
          },
          drawingInfo: {
            transparency:
              lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
          },
        };
      });
      this.url.searchParams.set("dynamicLayers", JSON.stringify(dynamicLayers));
    }
    for (const key in this.queryParameters) {
      this.url.searchParams.set(key, this.queryParameters[key].toString());
    }
    return this.url.toString();
  }

  private updateSource = () => {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(() => {
      delete this.debounceTimeout;
      const bounds = this.map.getBounds();
      this.source.updateImage({
        url: this.getUrl(),
        coordinates: [
          [bounds.getNorthWest().lng, bounds.getNorthWest().lat],
          [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
          [bounds.getSouthEast().lng, bounds.getSouthEast().lat],
          [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
        ],
      });
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
  updateLayers(layers: SublayerState[]) {
    // do a deep comparison of layers to detect whether there are any changes
    if (JSON.stringify(layers) !== JSON.stringify(this.layers)) {
      this.layers = layers;
      this.updateSource();
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
      JSON.stringify(this.queryParameters) !== JSON.stringify(queryParameters)
    ) {
      this.queryParameters = queryParameters;
      this.updateSource();
    }
  }

  /**
   * Update support for adjusting image resolution based on devicePixelRatio and
   * re-render the map. Useful for giving users the option to toggle
   * high-resolution images depending on network conditions.
   * @param enable
   */
  updateUseDevicePixelRatio(enable: boolean) {
    if (enable !== this.supportDevicePixelRatio) {
      this.supportDevicePixelRatio = enable;
      this.updateSource();
    }
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
