var MapBoxGLEsriSources = (function (exports) {
  'use strict';

  var getRandomValues;
  var rnds8 = new Uint8Array(16);
  function rng() {
    if (!getRandomValues) {
      getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);
      if (!getRandomValues) {
        throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
      }
    }
    return getRandomValues(rnds8);
  }

  var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

  function validate(uuid) {
    return typeof uuid === 'string' && REGEX.test(uuid);
  }

  var byteToHex = [];
  for (var i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).substr(1));
  }
  function stringify(arr) {
    var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
    if (!validate(uuid)) {
      throw TypeError('Stringified UUID is invalid');
    }
    return uuid;
  }

  function v4(options, buf, offset) {
    options = options || {};
    var rnds = options.random || (options.rng || rng)();
    rnds[6] = rnds[6] & 0x0f | 0x40;
    rnds[8] = rnds[8] & 0x3f | 0x80;
    if (buf) {
      offset = offset || 0;
      for (var i = 0; i < 16; ++i) {
        buf[offset + i] = rnds[i];
      }
      return buf;
    }
    return stringify(rnds);
  }

  function replaceSource(sourceId, map, sourceData) {
      var _a;
      const existingSource = map.getSource(sourceId);
      if (!existingSource) {
          throw new Error("Source does not exist");
      }
      if (existingSource.type !== sourceData.type) {
          throw new Error("Source type mismatch");
      }
      const allLayers = map.getStyle().layers || [];
      const relatedLayers = allLayers.filter((l) => {
          return "source" in l && l.source === sourceId;
      });
      relatedLayers.reverse();
      const idx = allLayers.indexOf(relatedLayers[0]);
      let before = ((_a = allLayers[idx + 1]) === null || _a === void 0 ? void 0 : _a.id) || undefined;
      for (const layer of relatedLayers) {
          map.removeLayer(layer.id);
      }
      map.removeSource(sourceId);
      map.addSource(sourceId, sourceData);
      for (const layer of relatedLayers) {
          map.addLayer(layer, before);
          before = layer.id;
      }
  }
  function metersToDegrees(x, y) {
      var lon = (x * 180) / 20037508.34;
      var lat = (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
      return [lon, lat];
  }
  async function extentToLatLngBounds(extent) {
      if (extent) {
          const wkid = normalizeSpatialReference(extent.spatialReference);
          if (wkid === 4326) {
              return [extent.xmin, extent.ymin, extent.xmax, extent.ymax];
          }
          else if (wkid === 3857 || wkid === 102100) {
              return [
                  ...metersToDegrees(extent.xmin, extent.ymin),
                  ...metersToDegrees(extent.xmax, extent.ymax),
              ];
          }
          else {
              try {
                  const projected = await projectExtent(extent);
                  return [projected.xmin, projected.ymin, projected.xmax, projected.ymax];
              }
              catch (e) {
                  console.error(e);
                  return;
              }
          }
      }
  }
  function normalizeSpatialReference(sr) {
      const wkid = "latestWkid" in sr ? sr.latestWkid : "wkid" in sr ? sr.wkid : -1;
      if (typeof wkid === "string") {
          if (/WGS\s*84/.test(wkid)) {
              return 4326;
          }
          else {
              return -1;
          }
      }
      else {
          return wkid || -1;
      }
  }
  async function projectExtent(extent) {
      const endpoint = "https://tasks.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer/project";
      const params = new URLSearchParams({
          geometries: JSON.stringify({
              geometryType: "esriGeometryEnvelope",
              geometries: [extent],
          }),
          inSR: `${extent.spatialReference.wkid}`,
          outSR: "4326",
          f: "json",
      });
      const response = await fetch(`${endpoint}?${params.toString()}`);
      const data = await response.json();
      const projected = data.geometries[0];
      if (projected) {
          return projected;
      }
      else {
          throw new Error("Failed to reproject");
      }
  }
  function contentOrFalse(str) {
      if (str && str.length > 0) {
          return str;
      }
      else {
          return false;
      }
  }
  function pickDescription(info, layer) {
      var _a, _b;
      return (contentOrFalse(layer === null || layer === void 0 ? void 0 : layer.description) ||
          contentOrFalse(info.description) ||
          contentOrFalse((_a = info.documentInfo) === null || _a === void 0 ? void 0 : _a.Subject) ||
          contentOrFalse((_b = info.documentInfo) === null || _b === void 0 ? void 0 : _b.Comments));
  }
  function generateMetadataForLayer(url, mapServerInfo, layer) {
      var _a, _b, _c, _d;
      const attribution = contentOrFalse(layer.copyrightText) ||
          contentOrFalse(mapServerInfo.copyrightText) ||
          contentOrFalse((_a = mapServerInfo.documentInfo) === null || _a === void 0 ? void 0 : _a.Author);
      const description = pickDescription(mapServerInfo, layer);
      let keywords = ((_b = mapServerInfo.documentInfo) === null || _b === void 0 ? void 0 : _b.Keywords) && ((_c = mapServerInfo.documentInfo) === null || _c === void 0 ? void 0 : _c.Keywords.length)
          ? (_d = mapServerInfo.documentInfo) === null || _d === void 0 ? void 0 : _d.Keywords.split(",") : [];
      return {
          type: "doc",
          content: [
              {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [{ type: "text", text: layer.name }],
              },
              ...(description
                  ? [
                      {
                          type: "paragraph",
                          content: [
                              {
                                  type: "text",
                                  text: description,
                              },
                          ],
                      },
                  ]
                  : []),
              ...(attribution
                  ? [
                      { type: "paragraph" },
                      {
                          type: "heading",
                          attrs: { level: 3 },
                          content: [{ type: "text", text: "Attribution" }],
                      },
                      {
                          type: "paragraph",
                          content: [
                              {
                                  type: "text",
                                  text: attribution,
                              },
                          ],
                      },
                  ]
                  : []),
              ...(keywords && keywords.length
                  ? [
                      { type: "paragraph" },
                      {
                          type: "heading",
                          attrs: { level: 3 },
                          content: [
                              {
                                  type: "text",
                                  text: "Keywords",
                              },
                          ],
                      },
                      {
                          type: "bullet_list",
                          marks: [],
                          attrs: {},
                          content: keywords.map((word) => ({
                              type: "list_item",
                              content: [
                                  {
                                      type: "paragraph",
                                      content: [{ type: "text", text: word }],
                                  },
                              ],
                          })),
                      },
                  ]
                  : []),
              { type: "paragraph" },
              {
                  type: "paragraph",
                  content: [
                      {
                          type: "text",
                          marks: [
                              {
                                  type: "link",
                                  attrs: {
                                      href: url,
                                      title: "ArcGIS Server",
                                  },
                              },
                          ],
                          text: url,
                      },
                  ],
              },
          ],
      };
  }
  function makeLegend(data, layerId) {
      const legendLayer = data.layers.find((l) => l.layerId === layerId);
      if (legendLayer) {
          return legendLayer.legend.map((legend) => {
              return {
                  id: legend.url,
                  label: legend.label && legend.label.length > 0
                      ? legend.label
                      : legendLayer.legend.length === 1
                          ? legendLayer.layerName
                          : "",
                  imageUrl: (legend === null || legend === void 0 ? void 0 : legend.imageData) ? `data:${legend.contentType};base64,${legend.imageData}`
                      : blankDataUri,
                  imageWidth: 20,
                  imageHeight: 20,
              };
          });
      }
      else {
          return undefined;
      }
  }

  const blankDataUri = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  class ArcGISDynamicMapService {
      constructor(requestManager, options) {
          this.supportsDynamicLayers = false;
          this._loading = true;
          this.respondToResolutionChange = () => {
              if (this.options.supportHighDpiDisplays) {
                  this.updateSource();
              }
              if (this.resolution) {
                  matchMedia(this.resolution).removeListener(this.respondToResolutionChange);
              }
              this.resolution = `(resolution: ${window.devicePixelRatio}dppx)`;
              matchMedia(this.resolution).addListener(this.respondToResolutionChange);
          };
          this.onMapData = (event) => {
              if (event.sourceId && event.sourceId === this.sourceId) {
                  this._loading = false;
              }
          };
          this.onMapError = (event) => {
              if (event.sourceId === this.sourceId &&
                  event.dataType === "source" &&
                  event.sourceDataType === "content") {
                  this._loading = false;
              }
          };
          this.updateSource = () => {
              var _a;
              this._loading = true;
              const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
              if (source && this.map) {
                  if (source.type === "raster") {
                      source.setTiles([this.getUrl()]);
                  }
                  else if (source.type === "image") {
                      const bounds = this.map.getBounds();
                      source.updateImage({
                          url: this.getUrl(),
                          coordinates: [
                              [bounds.getNorthWest().lng, bounds.getNorthWest().lat],
                              [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
                              [bounds.getSouthEast().lng, bounds.getSouthEast().lat],
                              [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
                          ],
                      });
                  }
                  else ;
              }
          };
          this.debouncedUpdateSource = () => {
              if (this.debounceTimeout) {
                  clearTimeout(this.debounceTimeout);
              }
              this.debounceTimeout = setTimeout(() => {
                  delete this.debounceTimeout;
                  this.updateSource();
              }, 5);
          };
          this.options = options;
          this.requestManager = requestManager;
          this.sourceId = (options === null || options === void 0 ? void 0 : options.sourceId) || v4();
          options.url = options.url.replace(/\/$/, "");
          if (!/rest\/services/.test(options.url) || !/MapServer/.test(options.url)) {
              throw new Error("Invalid ArcGIS REST Service URL");
          }
          this.resolution = `(resolution: ${window.devicePixelRatio}dppx)`;
          matchMedia(this.resolution).addListener(this.respondToResolutionChange);
      }
      getMetadata() {
          if (this.serviceMetadata && this.layerMetadata) {
              return Promise.resolve({
                  serviceMetadata: this.serviceMetadata,
                  layers: this.layerMetadata,
              });
          }
          else {
              return this.requestManager
                  .getMapServiceMetadata(this.options.url, {
                  credentials: this.options.credentials,
              })
                  .then(({ serviceMetadata, layers }) => {
                  this.serviceMetadata = serviceMetadata;
                  this.layerMetadata = layers;
                  this.supportsDynamicLayers = serviceMetadata.supportsDynamicLayers;
                  return { serviceMetadata, layers };
              });
          }
      }
      async getComputedMetadata() {
          var _a, _b;
          const { serviceMetadata, layers } = await this.getMetadata();
          const { bounds, minzoom, maxzoom, attribution } = await this.getComputedProperties();
          const results = /\/.+\/MapServer/.exec(this.options.url);
          let label = results ? results[0] : false;
          if (!label) {
              if ((_b = (_a = this.layerMetadata) === null || _a === void 0 ? void 0 : _a.layers) === null || _b === void 0 ? void 0 : _b[0]) {
                  label = this.layerMetadata.layers[0].name;
              }
          }
          const legendData = await this.requestManager.getLegendMetadata(this.options.url);
          const hiddenIds = new Set();
          for (const layer of layers.layers) {
              if (!layer.defaultVisibility) {
                  hiddenIds.add(layer.id);
              }
              else {
                  if (layer.parentLayer) {
                      if (hiddenIds.has(layer.parentLayer.id)) {
                          hiddenIds.add(layer.id);
                      }
                      else {
                          const parent = layers.layers.find((l) => { var _a; return l.id === ((_a = layer.parentLayer) === null || _a === void 0 ? void 0 : _a.id); });
                          if (parent && !parent.defaultVisibility) {
                              hiddenIds.add(layer.id);
                              hiddenIds.add(parent.id);
                          }
                      }
                  }
              }
          }
          return {
              bounds: bounds || undefined,
              minzoom,
              maxzoom,
              attribution,
              tableOfContentsItems: layers.layers.map((lyr) => {
                  legendData.layers.find((l) => l.layerId === lyr.id);
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
                  }
                  else {
                      return {
                          type: "data",
                          id: lyr.id.toString(),
                          label: lyr.name,
                          defaultVisibility: hiddenIds.has(lyr.id)
                              ? false
                              : lyr.defaultVisibility,
                          metadata: generateMetadataForLayer(this.options.url + "/" + lyr.id, this.serviceMetadata, lyr),
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
      async getComputedProperties() {
          var _a, _b;
          const { serviceMetadata, layers } = await this.getMetadata();
          const levels = ((_a = serviceMetadata.tileInfo) === null || _a === void 0 ? void 0 : _a.lods.map((l) => l.level)) || [];
          const attribution = contentOrFalse(layers.layers[0].copyrightText) ||
              contentOrFalse(serviceMetadata.copyrightText) ||
              contentOrFalse((_b = serviceMetadata.documentInfo) === null || _b === void 0 ? void 0 : _b.Author) ||
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
      async addToMap(map) {
          var _a;
          const { attribution, bounds } = await this.getComputedProperties();
          this.map = map;
          if (!((_a = this.options) === null || _a === void 0 ? void 0 : _a.useTiles)) {
              this.map.on("moveend", this.updateSource);
              this.map.on("data", this.onMapData);
              this.map.on("error", this.onMapError);
          }
          if (this.options.useTiles) {
              this.map.addSource(this.sourceId, {
                  type: "raster",
                  tiles: [this.getUrl()],
                  tileSize: this.options.tileSize || 256,
                  bounds: bounds,
                  attribution,
              });
          }
          else {
              const bounds = this.map.getBounds();
              this.map.addSource(this.sourceId, {
                  type: "image",
                  url: this.getUrl(),
                  coordinates: [
                      [bounds.getWest(), bounds.getNorth()],
                      [bounds.getEast(), bounds.getNorth()],
                      [bounds.getEast(), bounds.getSouth()],
                      [bounds.getWest(), bounds.getSouth()],
                  ],
              });
          }
          return this.sourceId;
      }
      removeFromMap(map) {
          if (map.getSource(this.sourceId)) {
              const layers = map.getStyle().layers || [];
              for (const layer of layers) {
                  if ("source" in layer && layer.source === this.sourceId) {
                      map.removeLayer(layer.id);
                  }
              }
              map.off("moveend", this.updateSource);
              map.off("data", this.onMapData);
              map.off("error", this.onMapError);
              map.removeSource(this.sourceId);
              this.map = undefined;
          }
      }
      destroy() {
          matchMedia(this.resolution).removeListener(this.respondToResolutionChange);
          if (this.map) {
              this.removeFromMap(this.map);
          }
      }
      getUrl() {
          if (!this.map) {
              throw new Error("Map not set");
          }
          let url = new URL(this.options.url + "/export");
          url.searchParams.set("f", "image");
          url.searchParams.set("transparent", "true");
          const bounds = this.map.getBounds();
          let bbox = [
              lon2meters(bounds.getWest()),
              lat2meters(bounds.getSouth()),
              lon2meters(bounds.getEast()),
              lat2meters(bounds.getNorth()),
          ];
          const groundResolution = getGroundResolution(this.map.getZoom() +
              (this.options.supportHighDpiDisplays ? window.devicePixelRatio - 1 : 0));
          const width = Math.round((bbox[2] - bbox[0]) / groundResolution);
          const height = Math.round((bbox[3] - bbox[1]) / groundResolution);
          url.searchParams.set("format", "png");
          url.searchParams.set("size", [width, height].join(","));
          if (this.options.supportHighDpiDisplays) {
              switch (window.devicePixelRatio) {
                  case 1:
                      url.searchParams.set("dpi", "96");
                      break;
                  case 2:
                      url.searchParams.set("dpi", "220");
                      break;
                  case 3:
                      url.searchParams.set("dpi", "390");
                      break;
                  default:
                      url.searchParams.set("dpi",
                      (window.devicePixelRatio * 96 * 1.22).toString());
                      break;
              }
          }
          else {
              url.searchParams.set("dpi", "96");
          }
          url.searchParams.set("imageSR", "102100");
          url.searchParams.set("bboxSR", "102100");
          if (Math.abs(bbox[0]) > 20037508.34 || Math.abs(bbox[2]) > 20037508.34) {
              const centralMeridian = bounds.getCenter().lng;
              if (this.options.supportHighDpiDisplays && window.devicePixelRatio > 1) {
                  bbox[0] = -(width * groundResolution) / (window.devicePixelRatio * 2);
                  bbox[2] = (width * groundResolution) / (window.devicePixelRatio * 2);
              }
              else {
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
              }
              else {
                  url.searchParams.set("layers", `show:${this.layers.map((lyr) => lyr.id).join(",")}`);
              }
          }
          url.searchParams.set("bbox", bbox.join(","));
          url.searchParams.delete("dynamicLayers");
          let layersInOrder = true;
          let hasOpacityUpdates = false;
          if (this.supportsDynamicLayers && this.layers) {
              for (var i = 0; i < this.layers.length; i++) {
                  if (this.layers[i - 1] &&
                      parseInt(this.layers[i].id) < parseInt(this.layers[i - 1].id)) {
                      layersInOrder = false;
                  }
                  const opacity = this.layers[i].opacity;
                  if (opacity !== undefined && opacity < 1) {
                      hasOpacityUpdates = true;
                  }
              }
          }
          if (this.layers && (!layersInOrder || hasOpacityUpdates)) {
              const dynamicLayers = this.layers.map((lyr) => {
                  return {
                      id: lyr.id,
                      source: {
                          mapLayerId: lyr.id,
                          type: "mapLayer",
                      },
                      drawingInfo: {
                          transparency: lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
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
              }
              else {
                  url.searchParams.set("size", [tileSize, tileSize].join(","));
              }
          }
          return url.toString().replace("seasketch-replace-me", "{bbox-epsg-3857}");
      }
      get loading() {
          var _a;
          const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
          if (source && source.type === "raster") {
              return this.map.isSourceLoaded(this.sourceId) === false;
          }
          else {
              return this._loading;
          }
      }
      updateLayers(layers) {
          if (JSON.stringify(layers) !== JSON.stringify(this.layers)) {
              this.layers = layers;
              this.debouncedUpdateSource();
          }
      }
      updateQueryParameters(queryParameters) {
          if (JSON.stringify(this.options.queryParameters) !==
              JSON.stringify(queryParameters)) {
              this.options.queryParameters = queryParameters;
              this.debouncedUpdateSource();
          }
      }
      updateUseDevicePixelRatio(enable) {
          if (enable !== this.options.supportHighDpiDisplays) {
              this.options.supportHighDpiDisplays = enable;
              this.debouncedUpdateSource();
          }
      }
      async getGLStyleLayers() {
          return {
              layers: [
                  {
                      id: v4(),
                      type: "raster",
                      source: this.sourceId,
                      paint: {
                          "raster-fade-duration": this.options.useTiles ? 300 : 0,
                      },
                  },
              ],
          };
      }
  }
  function lat2meters(lat) {
      var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
      return (y * 20037508.34) / 180;
  }
  function lon2meters(lon) {
      return (lon * 20037508.34) / 180;
  }
  function getGroundResolution(level) {
      let groundResolution = resolutions[level];
      if (!groundResolution) {
          groundResolution = (2 * Math.PI * 6378137) / (256 * 2 ** (level + 1));
          resolutions[level] = groundResolution;
      }
      return groundResolution;
  }
  const resolutions = {};

  class ArcGISVectorSource {
      constructor(map, id, url, options) {
          var _a;
          this.data = {
              type: "FeatureCollection",
              features: [],
          };
          this.outFields = "*";
          this.supportsPagination = true;
          this._loading = true;
          this._id = id;
          this.baseUrl = url;
          this.options = options;
          this.map = map;
          this.map.addSource(this._id, {
              data: this.data,
              type: "geojson",
          });
          if (options &&
              "supportsPagination" in options &&
              options["supportsPagination"] === false) {
              this.supportsPagination = false;
          }
          if (options && options.outFields) {
              this.outFields = options.outFields;
          }
          this.source = this.map.getSource(this._id);
          let hadError = false;
          const onError = (e) => {
              hadError = true;
              this._loading = false;
              this.map.fire("error", {
                  source: this.source,
                  sourceId: this._id,
                  error: e,
              });
          };
          this.map.fire("dataloading", {
              source: this.source,
              sourceId: this._id,
              dataType: "source",
              isSourceLoaded: false,
              sourceDataType: "content",
          });
          fetchFeatureLayerData$1(this.baseUrl, this.outFields, onError, (_a = this.options) === null || _a === void 0 ? void 0 : _a.geometryPrecision, null, null, false, 1000, options === null || options === void 0 ? void 0 : options.bytesLimit)
              .then((fc) => {
              this._loading = false;
              if (!hadError) {
                  this.source.setData(fc);
              }
          })
              .catch(onError);
      }
      get loading() {
          return this._loading;
      }
      get id() {
          return this._id;
      }
      destroy() {
          this.map.removeSource(this._id);
      }
  }
  async function fetchFeatureLayerData$1(url, outFields, onError, geometryPrecision = 6, abortController = null, onPageReceived = null, disablePagination = false, pageSize = 1000, bytesLimit) {
      const featureCollection = {
          type: "FeatureCollection",
          features: [],
      };
      const params = new URLSearchParams({
          inSR: "4326",
          outSR: "4326",
          where: "1>0",
          outFields,
          returnGeometry: "true",
          geometryPrecision: geometryPrecision.toString(),
          returnIdsOnly: "false",
          f: "geojson",
      });
      await fetchData$1(url, params, featureCollection, onError, abortController || new AbortController(), onPageReceived, disablePagination, pageSize, bytesLimit);
      return featureCollection;
  }
  async function fetchData$1(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination = false, pageSize = 1000, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount) {
      bytesReceived = bytesReceived || 0;
      new TextDecoder("utf-8");
      params.set("returnIdsOnly", "false");
      if (featureCollection.features.length > 0) {
          params.delete("where");
          params.delete("resultOffset");
          params.delete("resultRecordCount");
          params.set("orderByFields", objectIdFieldName);
          const lastFeature = featureCollection.features[featureCollection.features.length - 1];
          params.set("where", `${objectIdFieldName}>${lastFeature.id}`);
      }
      const response = await fetch(`${baseUrl}/query?${params.toString()}`, {
          mode: "cors",
          signal: abortController.signal,
      });
      const str = await response.text();
      bytesReceived += byteLength$1(str);
      if (bytesLimit && bytesReceived >= bytesLimit) {
          const e = new Error(`Exceeded bytesLimit. ${bytesReceived} >= ${bytesLimit}`);
          return onError(e);
      }
      const fc = JSON.parse(str);
      if (fc.error) {
          return onError(new Error(fc.error.message));
      }
      else {
          featureCollection.features.push(...fc.features);
          if (fc.exceededTransferLimit) {
              if (!objectIdFieldName) {
                  params.set("returnIdsOnly", "true");
                  try {
                      const r = await fetch(`${baseUrl}/query?${params.toString()}`, {
                          mode: "cors",
                          signal: abortController.signal,
                      });
                      const featureIds = featureCollection.features.map((f) => f.id);
                      const objectIdParameters = await r.json();
                      expectedFeatureCount = objectIdParameters.objectIds.length;
                      objectIdFieldName = objectIdParameters.objectIdFieldName;
                  }
                  catch (e) {
                      return onError(e);
                  }
              }
              if (onPageReceived) {
                  onPageReceived(bytesReceived, featureCollection.features.length, expectedFeatureCount);
              }
              await fetchData$1(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination, pageSize, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount);
          }
      }
      return bytesReceived;
  }
  function byteLength$1(str) {
      var s = str.length;
      for (var i = str.length - 1; i >= 0; i--) {
          var code = str.charCodeAt(i);
          if (code > 0x7f && code <= 0x7ff)
              s++;
          else if (code > 0x7ff && code <= 0xffff)
              s += 2;
          if (code >= 0xdc00 && code <= 0xdfff)
              i--;
      }
      return s;
  }

  class ArcGISRESTServiceRequestManager {
      constructor(options) {
          this.inFlightRequests = {};
          caches
              .open((options === null || options === void 0 ? void 0 : options.cacheKey) || "seasketch-arcgis-rest-services")
              .then((cache) => {
              this.cache = cache;
          });
      }
      async getMapServiceMetadata(url, options) {
          if (!/rest\/services/.test(url)) {
              throw new Error("Invalid ArcGIS REST Service URL");
          }
          if (!/MapServer/.test(url)) {
              throw new Error("Invalid MapServer URL");
          }
          url = url.replace(/\/$/, "");
          url = url.replace(/\?.*$/, "");
          const params = new URLSearchParams();
          params.set("f", "json");
          if (options === null || options === void 0 ? void 0 : options.credentials) {
              const token = await this.getToken(url.replace(/rest\/services\/.*/, "/rest/services/"), options.credentials);
              params.set("token", token);
          }
          const requestUrl = `${url}?${params.toString()}`;
          const serviceMetadata = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
          const layers = await this.fetch(`${url}/layers?${params.toString()}`);
          if (layers.error) {
              throw new Error(layers.error.message);
          }
          return { serviceMetadata, layers };
      }
      async getFeatureServerMetadata(url, options) {
          url = url.replace(/\/$/, "");
          if (!/rest\/services/.test(url)) {
              throw new Error("Invalid ArcGIS REST Service URL");
          }
          if (!/FeatureServer/.test(url)) {
              throw new Error("Invalid FeatureServer URL");
          }
          if (/\d+$/.test(url)) {
              throw new Error("Invalid FeatureServer URL");
          }
          url = url.replace(/\?.*$/, "");
          const params = new URLSearchParams();
          params.set("f", "json");
          if (options === null || options === void 0 ? void 0 : options.credentials) {
              const token = await this.getToken(url.replace(/rest\/services\/.*/, "/rest/services/"), options.credentials);
              params.set("token", token);
          }
          const requestUrl = `${url}?${params.toString()}`;
          const serviceMetadata = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
          const layers = await this.fetch(`${url}/layers?${params.toString()}`);
          if (layers.error) {
              throw new Error(layers.error.message);
          }
          return { serviceMetadata, layers };
      }
      async getCatalogItems(url, options) {
          if (!/rest\/services/.test(url)) {
              throw new Error("Invalid ArcGIS REST Service URL");
          }
          url = url.replace(/\/$/, "");
          url = url.replace(/\?.*$/, "");
          const params = new URLSearchParams();
          params.set("f", "json");
          if (options === null || options === void 0 ? void 0 : options.credentials) {
              const token = await this.getToken(url.replace(/rest\/services\/.*/, "/rest/services/"), options.credentials);
              params.set("token", token);
          }
          const requestUrl = `${url}?${params.toString()}`;
          const response = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
          return response;
      }
      async getToken(url, credentials) {
          throw new Error("Not implemented");
      }
      async fetch(url, signal) {
          if (url in this.inFlightRequests) {
              return this.inFlightRequests[url].then((json) => json);
          }
          const cache = await this.cache;
          if (!cache) {
              throw new Error("Cache not initialized");
          }
          this.inFlightRequests[url] = fetchWithTTL(url, 60 * 300, cache, { signal });
          return new Promise((resolve, reject) => {
              this.inFlightRequests[url]
                  .then((json) => {
                  if (json["error"]) {
                      reject(new Error(json["error"].message));
                  }
                  else {
                      resolve(json);
                  }
              })
                  .catch(reject)
                  .finally(() => {
                  delete this.inFlightRequests[url];
              });
          });
      }
      async getLegendMetadata(url, credentials) {
          if (!/rest\/services/.test(url)) {
              throw new Error("Invalid ArcGIS REST Service URL");
          }
          if (!/MapServer/.test(url) && !/FeatureServer/.test(url)) {
              throw new Error("Invalid MapServer or FeatureServer URL");
          }
          url = url.replace(/\/$/, "");
          url = url.replace(/\?.*$/, "");
          const params = new URLSearchParams();
          params.set("f", "json");
          if (credentials) {
              const token = await this.getToken(url.replace(/rest\/services\/.*/, "/rest/services/"), credentials);
              params.set("token", token);
          }
          const requestUrl = `${url}/legend?${params.toString()}`;
          const response = await this.fetch(requestUrl);
          return response;
      }
  }
  function cachedResponseIsExpired(response) {
      const cacheControlHeader = response.headers.get("Cache-Control");
      if (cacheControlHeader) {
          const expires = /expires=(.*)/i.exec(cacheControlHeader);
          if (expires) {
              const expiration = new Date(expires[1]);
              if (new Date().getTime() > expiration.getTime()) {
                  return true;
              }
              else {
                  return false;
              }
          }
      }
      return false;
  }
  async function fetchWithTTL(url, ttl, cache, options
  ) {
      var _a, _b, _c;
      if (!((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.aborted)) {
          const request = new Request(url, options);
          if ((_b = options === null || options === void 0 ? void 0 : options.signal) === null || _b === void 0 ? void 0 : _b.aborted) {
              Promise.reject("aborted");
          }
          let cachedResponse = await cache.match(request);
          if (cachedResponse && cachedResponseIsExpired(cachedResponse)) {
              cache.delete(request);
              cachedResponse = undefined;
          }
          if (cachedResponse) {
              return cachedResponse.json();
          }
          else {
              const response = await fetch(url, options);
              if (!((_c = options === null || options === void 0 ? void 0 : options.signal) === null || _c === void 0 ? void 0 : _c.aborted)) {
                  const headers = new Headers(response.headers);
                  headers.set("Cache-Control", `Expires=${new Date(new Date().getTime() + 1000 * ttl).toUTCString()}`);
                  const copy = response.clone();
                  const clone = new Response(copy.body, {
                      headers,
                      status: response.status,
                      statusText: response.statusText,
                  });
                  cache.put(url, clone);
              }
              return await response.json();
          }
      }
  }

  class ArcGISTiledMapService {
      constructor(requestManager, options) {
          options.url = options.url.replace(/\/$/, "");
          if (!/rest\/services/.test(options.url) || !/MapServer/.test(options.url)) {
              throw new Error("Invalid ArcGIS REST Service URL");
          }
          this.requestManager = requestManager;
          this.sourceId = options.sourceId || v4();
          this.options = options;
      }
      getMetadata() {
          if (this.serviceMetadata && this.layerMetadata) {
              return Promise.resolve({
                  serviceMetadata: this.serviceMetadata,
                  layers: this.layerMetadata,
              });
          }
          else {
              return this.requestManager
                  .getMapServiceMetadata(this.options.url, {
                  credentials: this.options.credentials,
              })
                  .then(({ serviceMetadata, layers }) => {
                  this.serviceMetadata = serviceMetadata;
                  this.layerMetadata = layers;
                  return { serviceMetadata, layers };
              });
          }
      }
      async getComputedMetadata() {
          var _a, _b;
          await this.getMetadata();
          const { bounds, minzoom, maxzoom, tileSize, attribution } = await this.getComputedProperties();
          const legendData = await this.requestManager.getLegendMetadata(this.options.url);
          const results = /\/([^/]+)\/MapServer/.exec(this.options.url);
          let label = results && results.length >= 1 ? results[1] : false;
          if (!label) {
              if ((_b = (_a = this.layerMetadata) === null || _a === void 0 ? void 0 : _a.layers) === null || _b === void 0 ? void 0 : _b[0]) {
                  label = this.layerMetadata.layers[0].name;
              }
          }
          return {
              bounds: bounds || undefined,
              minzoom,
              maxzoom,
              attribution,
              tableOfContentsItems: [
                  {
                      type: "data",
                      id: this.sourceId,
                      label: label || "Layer",
                      defaultVisibility: true,
                      metadata: generateMetadataForLayer(this.options.url, this.serviceMetadata, this.layerMetadata.layers[0]),
                      legend: makeLegend(legendData, legendData.layers[0].layerId),
                  },
              ],
              supportsDynamicRendering: {
                  layerOrder: false,
                  layerOpacity: false,
                  layerVisibility: false,
              },
          };
      }
      get loading() {
          var _a, _b;
          return Boolean(((_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId)) &&
              ((_b = this.map) === null || _b === void 0 ? void 0 : _b.isSourceLoaded(this.sourceId)) === false);
      }
      async getComputedProperties() {
          var _a, _b, _c;
          const { serviceMetadata, layers } = await this.getMetadata();
          const levels = ((_a = serviceMetadata.tileInfo) === null || _a === void 0 ? void 0 : _a.lods.map((l) => l.level)) || [];
          const attribution = contentOrFalse(layers.layers[0].copyrightText) ||
              contentOrFalse(serviceMetadata.copyrightText) ||
              contentOrFalse((_b = serviceMetadata.documentInfo) === null || _b === void 0 ? void 0 : _b.Author) ||
              undefined;
          const minzoom = Math.min(...levels);
          const maxzoom = Math.max(...levels);
          if (!((_c = serviceMetadata.tileInfo) === null || _c === void 0 ? void 0 : _c.rows)) {
              throw new Error("Invalid tile info");
          }
          return {
              minzoom,
              maxzoom,
              bounds: await extentToLatLngBounds(serviceMetadata.fullExtent),
              tileSize: serviceMetadata.tileInfo.rows,
              attribution,
          };
      }
      async addToMap(map) {
          this.map = map;
          const { minzoom, maxzoom, bounds, tileSize, attribution } = await this.getComputedProperties();
          const sourceData = {
              type: "raster",
              tiles: [`${this.options.url}/tile/{z}/{y}/{x}`],
              tileSize: this.options.supportHighDpiDisplays
                  ? tileSize / window.devicePixelRatio
                  : tileSize,
              minzoom,
              maxzoom,
              attribution,
              ...(bounds ? { bounds } : {}),
          };
          if (this.map.getSource(this.sourceId)) {
              replaceSource(this.sourceId, this.map, sourceData);
          }
          else {
              this.map.addSource(this.sourceId, sourceData);
          }
          return this.sourceId;
      }
      async getGLStyleLayers() {
          return {
              layers: [
                  {
                      type: "raster",
                      source: this.sourceId,
                      id: v4(),
                      paint: {
                          "raster-fade-duration": 300,
                      },
                  },
              ],
          };
      }
      removeFromMap(map) {
          if (map.getSource(this.sourceId)) {
              const layers = map.getStyle().layers || [];
              for (const layer of layers) {
                  if ("source" in layer && layer.source === this.sourceId) {
                      map.removeLayer(layer.id);
                  }
              }
              map.removeSource(this.sourceId);
              this.map = undefined;
          }
      }
      destroy() {
          if (this.map) {
              this.removeFromMap(this.map);
          }
      }
      updateLayers(layers) { }
  }

  function fetchFeatureCollection(url, geometryPrecision = 6, outFields = "*", bytesLimit = 1000000 * 100) {
      return new Promise((resolve, reject) => {
          fetchFeatureLayerData(url, outFields, reject, geometryPrecision, null, null, undefined, undefined, bytesLimit)
              .then((data) => resolve(data))
              .catch((e) => reject(e));
      });
  }
  async function fetchFeatureLayerData(url, outFields, onError, geometryPrecision = 6, abortController = null, onPageReceived = null, disablePagination = false, pageSize = 1000, bytesLimit) {
      const featureCollection = {
          type: "FeatureCollection",
          features: [],
      };
      const params = new URLSearchParams({
          inSR: "4326",
          outSR: "4326",
          where: "1>0",
          outFields,
          returnGeometry: "true",
          geometryPrecision: geometryPrecision.toString(),
          returnIdsOnly: "false",
          f: "geojson",
      });
      await fetchData(url, params, featureCollection, onError, abortController, onPageReceived, disablePagination, pageSize, bytesLimit);
      return featureCollection;
  }
  async function fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination = false, pageSize = 1000, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount) {
      var _a;
      bytesReceived = bytesReceived || 0;
      new TextDecoder("utf-8");
      params.set("returnIdsOnly", "false");
      if (featureCollection.features.length > 0) {
          params.delete("where");
          params.delete("resultOffset");
          params.delete("resultRecordCount");
          params.set("orderByFields", objectIdFieldName);
          const lastFeature = featureCollection.features[featureCollection.features.length - 1];
          params.set("where", `${objectIdFieldName}>${lastFeature.id}`);
      }
      const response = await fetch(`${baseUrl}/query?${params.toString()}`, {
          ...(abortController ? { signal: abortController.signal } : {}),
      });
      const str = await response.text();
      bytesReceived += byteLength(str);
      if (bytesLimit && bytesReceived > bytesLimit) {
          const e = new Error(`Exceeded bytesLimit. ${bytesReceived} > ${bytesLimit}`);
          return onError(e);
      }
      const fc = JSON.parse(str);
      if (fc.error) {
          return onError(new Error(fc.error.message));
      }
      else {
          featureCollection.features.push(...fc.features);
          if (fc.exceededTransferLimit || ((_a = fc.properties) === null || _a === void 0 ? void 0 : _a.exceededTransferLimit)) {
              if (!objectIdFieldName) {
                  params.set("returnIdsOnly", "true");
                  try {
                      const r = await fetch(`${baseUrl}/query?${params.toString()}`, {
                          ...(abortController ? { signal: abortController.signal } : {}),
                      });
                      const featureIds = featureCollection.features.map((f) => f.id);
                      let objectIdParameters = await r.json();
                      if (objectIdParameters.properties) {
                          objectIdParameters = objectIdParameters.properties;
                      }
                      expectedFeatureCount = objectIdParameters.objectIds.length;
                      objectIdFieldName = objectIdParameters.objectIdFieldName;
                  }
                  catch (e) {
                      return onError(e);
                  }
              }
              if (onPageReceived) {
                  onPageReceived(bytesReceived, featureCollection.features.length, expectedFeatureCount);
              }
              await fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination, pageSize, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount);
          }
      }
      return bytesReceived;
  }
  function byteLength(str) {
      var s = str.length;
      for (var i = str.length - 1; i >= 0; i--) {
          var code = str.charCodeAt(i);
          if (code > 0x7f && code <= 0x7ff)
              s++;
          else if (code > 0x7ff && code <= 0xffff)
              s += 2;
          if (code >= 0xdc00 && code <= 0xdfff)
              i--;
      }
      return s;
  }

  const EventEmitter = require("eventemitter3");
  const tilebelt$1 = require("@mapbox/tilebelt");
  const debounce = require("lodash.debounce");
  class QuantizedVectorRequestManager extends EventEmitter {
      constructor(map) {
          super();
          this.removeEventListeners = (map) => {
              map.off("moveend", this.updateSources);
              map.off("move", this.debouncedUpdateSources);
              map.off("remove", this.removeEventListeners);
              try {
                  this.removeDebugLayer();
              }
              catch (e) {
              }
          };
          this.displayedTiles = "";
          this.viewPortDetails = {
              tiles: [],
              tolerance: 0,
          };
          this.updateSources = () => {
              const bounds = this.map.getBounds();
              const boundsArray = bounds.toArray();
              const tiles = this.getTilesForBounds(bounds);
              const key = tiles
                  .map((t) => tilebelt$1.tileToQuadkey(t))
                  .sort()
                  .join(",");
              if (key !== this.displayedTiles) {
                  this.displayedTiles = key;
                  const mapWidth = Math.abs(boundsArray[1][0] - boundsArray[0][0]);
                  const tolerance = (mapWidth / this.map.getCanvas().width) * 0.3;
                  this.viewPortDetails = {
                      tiles,
                      tolerance,
                  };
                  this.emit("update", { tiles });
              }
              {
                  this.updateDebugLayer(tiles);
              }
          };
          this.debouncedUpdateSources = debounce(this.updateSources, 100, {
              maxWait: 200,
          });
          this.map = map;
          this.addEventListeners(map);
          {
              this.addDebugLayer();
          }
      }
      addDebugLayer() {
          this.map.addSource("debug-quantized-vector-request-manager", {
              type: "geojson",
              data: {
                  type: "FeatureCollection",
                  features: [],
              },
          });
          this.map.addLayer({
              id: "debug-quantized-vector-request-manager",
              type: "line",
              source: "debug-quantized-vector-request-manager",
              paint: {
                  "line-color": "red",
                  "line-width": 2,
              },
          });
      }
      removeDebugLayer() {
          this.map.removeLayer("debug-quantized-vector-request-manager");
          this.map.removeSource("debug-quantized-vector-request-manager");
      }
      addEventListeners(map) {
          map.on("moveend", this.updateSources);
          map.on("move", this.debouncedUpdateSources);
          map.on("remove", this.removeEventListeners);
      }
      updateDebugLayer(tiles) {
          const source = this.map.getSource("debug-quantized-vector-request-manager");
          const fc = {
              type: "FeatureCollection",
              features: tiles.map((t) => ({
                  type: "Feature",
                  properties: { label: `${t[2]}/${t[0]}/${1}` },
                  geometry: tilebelt$1.tileToGeoJSON(t),
              })),
          };
          console.log(fc);
          source.setData(fc);
      }
      getTilesForBounds(bounds) {
          const z = this.map.getZoom();
          const boundsArray = bounds.toArray();
          const primaryTile = tilebelt$1.bboxToTile([
              boundsArray[0][0],
              boundsArray[0][1],
              boundsArray[1][0],
              boundsArray[1][1],
          ]);
          const zoomLevel = 2 * Math.floor(z / 2);
          const tilesToRequest = [];
          if (primaryTile[2] < zoomLevel) {
              let candidateTiles = tilebelt$1.getChildren(primaryTile);
              let minZoomOfCandidates = candidateTiles[0][2];
              while (minZoomOfCandidates < zoomLevel) {
                  const newCandidateTiles = [];
                  candidateTiles.forEach((t) => newCandidateTiles.push(...tilebelt$1.getChildren(t)));
                  candidateTiles = newCandidateTiles;
                  minZoomOfCandidates = candidateTiles[0][2];
              }
              for (let index = 0; index < candidateTiles.length; index++) {
                  if (this.doesTileOverlapBbox(candidateTiles[index], boundsArray)) {
                      tilesToRequest.push(candidateTiles[index]);
                  }
              }
          }
          else {
              tilesToRequest.push(primaryTile);
          }
          return tilesToRequest;
      }
      doesTileOverlapBbox(tile, bbox) {
          const tileBounds = tile.length === 4 ? tile : tilebelt$1.tileToBBOX(tile);
          if (tileBounds[2] < bbox[0][0])
              return false;
          if (tileBounds[0] > bbox[1][0])
              return false;
          if (tileBounds[3] < bbox[0][1])
              return false;
          if (tileBounds[1] > bbox[1][1])
              return false;
          return true;
      }
  }
  const managers = new WeakMap();
  function getOrCreateQuantizedVectorRequestManager(map) {
      if (!managers.has(map)) {
          managers.set(map, new QuantizedVectorRequestManager(map));
      }
      return managers.get(map);
  }

  var d2r = Math.PI / 180,
      r2d = 180 / Math.PI;
  function tileToBBOX(tile) {
      var e = tile2lon(tile[0] + 1, tile[2]);
      var w = tile2lon(tile[0], tile[2]);
      var s = tile2lat(tile[1] + 1, tile[2]);
      var n = tile2lat(tile[1], tile[2]);
      return [w, s, e, n];
  }
  function tileToGeoJSON(tile) {
      var bbox = tileToBBOX(tile);
      var poly = {
          type: 'Polygon',
          coordinates: [[
              [bbox[0], bbox[3]],
              [bbox[0], bbox[1]],
              [bbox[2], bbox[1]],
              [bbox[2], bbox[3]],
              [bbox[0], bbox[3]]
          ]]
      };
      return poly;
  }
  function tile2lon(x, z) {
      return x / Math.pow(2, z) * 360 - 180;
  }
  function tile2lat(y, z) {
      var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
      return r2d * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }
  function pointToTile(lon, lat, z) {
      var tile = pointToTileFraction(lon, lat, z);
      tile[0] = Math.floor(tile[0]);
      tile[1] = Math.floor(tile[1]);
      return tile;
  }
  function getChildren(tile) {
      return [
          [tile[0] * 2, tile[1] * 2, tile[2] + 1],
          [tile[0] * 2 + 1, tile[1] * 2, tile[2 ] + 1],
          [tile[0] * 2 + 1, tile[1] * 2 + 1, tile[2] + 1],
          [tile[0] * 2, tile[1] * 2 + 1, tile[2] + 1]
      ];
  }
  function getParent(tile) {
      return [tile[0] >> 1, tile[1] >> 1, tile[2] - 1];
  }
  function getSiblings(tile) {
      return getChildren(getParent(tile));
  }
  function hasSiblings(tile, tiles) {
      var siblings = getSiblings(tile);
      for (var i = 0; i < siblings.length; i++) {
          if (!hasTile(tiles, siblings[i])) return false;
      }
      return true;
  }
  function hasTile(tiles, tile) {
      for (var i = 0; i < tiles.length; i++) {
          if (tilesEqual(tiles[i], tile)) return true;
      }
      return false;
  }
  function tilesEqual(tile1, tile2) {
      return (
          tile1[0] === tile2[0] &&
          tile1[1] === tile2[1] &&
          tile1[2] === tile2[2]
      );
  }
  function tileToQuadkey(tile) {
      var index = '';
      for (var z = tile[2]; z > 0; z--) {
          var b = 0;
          var mask = 1 << (z - 1);
          if ((tile[0] & mask) !== 0) b++;
          if ((tile[1] & mask) !== 0) b += 2;
          index += b.toString();
      }
      return index;
  }
  function quadkeyToTile(quadkey) {
      var x = 0;
      var y = 0;
      var z = quadkey.length;
      for (var i = z; i > 0; i--) {
          var mask = 1 << (i - 1);
          var q = +quadkey[z - i];
          if (q === 1) x |= mask;
          if (q === 2) y |= mask;
          if (q === 3) {
              x |= mask;
              y |= mask;
          }
      }
      return [x, y, z];
  }
  function bboxToTile(bboxCoords) {
      var min = pointToTile(bboxCoords[0], bboxCoords[1], 32);
      var max = pointToTile(bboxCoords[2], bboxCoords[3], 32);
      var bbox = [min[0], min[1], max[0], max[1]];
      var z = getBboxZoom(bbox);
      if (z === 0) return [0, 0, 0];
      var x = bbox[0] >>> (32 - z);
      var y = bbox[1] >>> (32 - z);
      return [x, y, z];
  }
  function getBboxZoom(bbox) {
      var MAX_ZOOM = 28;
      for (var z = 0; z < MAX_ZOOM; z++) {
          var mask = 1 << (32 - (z + 1));
          if (((bbox[0] & mask) !== (bbox[2] & mask)) ||
              ((bbox[1] & mask) !== (bbox[3] & mask))) {
              return z;
          }
      }
      return MAX_ZOOM;
  }
  function pointToTileFraction(lon, lat, z) {
      var sin = Math.sin(lat * d2r),
          z2 = Math.pow(2, z),
          x = z2 * (lon / 360 + 0.5),
          y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
      x = x % z2;
      if (x < 0) x = x + z2;
      return [x, y, z];
  }
  var tilebelt = {
      tileToGeoJSON: tileToGeoJSON,
      tileToBBOX: tileToBBOX,
      getChildren: getChildren,
      getParent: getParent,
      getSiblings: getSiblings,
      hasTile: hasTile,
      hasSiblings: hasSiblings,
      tilesEqual: tilesEqual,
      tileToQuadkey: tileToQuadkey,
      quadkeyToTile: quadkeyToTile,
      pointToTile: pointToTile,
      bboxToTile: bboxToTile,
      pointToTileFraction: pointToTileFraction
  };

  const tileDecode = require("arcgis-pbf-parser");
  class ArcGISFeatureLayerSource {
      constructor(requestManager, options) {
          var _a;
          this._loading = true;
          this.rawFeaturesHaveBeenFetched = false;
          this.exceededBytesLimit = false;
          this.sourceId = options.sourceId || v4();
          this.options = options;
          this.requestManager = requestManager;
          options.url = options.url.replace(/\/$/, "");
          if (!/rest\/services/.test(options.url) ||
              (!/MapServer/.test(options.url) && !/FeatureServer/.test(options.url))) {
              throw new Error("Invalid ArcGIS REST Service URL");
          }
          if (!/\d+$/.test(options.url)) {
              throw new Error("URL must end in /FeatureServer/{layerId} or /MapServer/{layerId}");
          }
          this.layerId = parseInt(((_a = options.url.match(/\d+$/)) === null || _a === void 0 ? void 0 : _a[0]) || "0");
      }
      async getComputedMetadata() {
          const { serviceMetadata, layers } = await this.getMetadata();
          const { bounds, minzoom, maxzoom, attribution } = await this.getComputedProperties();
          const layer = layers.layers.find((l) => l.id === this.layerId);
          const glStyle = await this.getGLStyleLayers();
          if (!layer) {
              throw new Error("Layer not found");
          }
          return {
              bounds,
              minzoom,
              maxzoom,
              attribution,
              supportsDynamicRendering: {
                  layerOpacity: false,
                  layerVisibility: false,
                  layerOrder: false,
              },
              tableOfContentsItems: [
                  {
                      type: "data",
                      defaultVisibility: true,
                      id: this.sourceId,
                      label: layer.name,
                      metadata: generateMetadataForLayer(this.options.url.replace(/\/\d+$/, ""), serviceMetadata, layer),
                      glStyle: glStyle,
                  },
              ],
          };
      }
      async getComputedProperties() {
          const { serviceMetadata, layers } = await this.getMetadata();
          const attribution = contentOrFalse(serviceMetadata.copyrightText) || undefined;
          const layer = layers.layers.find((l) => l.id === this.layerId);
          if (!layer) {
              throw new Error(`Sublayer ${this.layerId} not found`);
          }
          return {
              minzoom: 0,
              maxzoom: 24,
              bounds: (await extentToLatLngBounds((layer === null || layer === void 0 ? void 0 : layer.extent) || serviceMetadata.fullExtent)) || undefined,
              attribution,
          };
      }
      fireError(e) {
          var _a;
          (_a = this.map) === null || _a === void 0 ? void 0 : _a.fire("error", {
              sourceId: this.sourceId,
              error: e.message,
          });
      }
      getMetadata() {
          if (this.serviceMetadata && this.layerMetadata) {
              return Promise.resolve({
                  serviceMetadata: this.serviceMetadata,
                  layers: this.layerMetadata,
              });
          }
          else {
              if (/FeatureServer/.test(this.options.url)) {
                  return this.requestManager
                      .getFeatureServerMetadata(this.options.url.replace(/\/\d+$/, ""), {
                      credentials: this.options.credentials,
                  })
                      .then(({ serviceMetadata, layers }) => {
                      this.serviceMetadata = serviceMetadata;
                      this.layerMetadata = layers;
                      return { serviceMetadata, layers };
                  });
              }
              else {
                  return this.requestManager
                      .getMapServiceMetadata(this.options.url, {
                      credentials: this.options.credentials,
                  })
                      .then(({ serviceMetadata, layers }) => {
                      this.serviceMetadata = serviceMetadata;
                      this.layerMetadata = layers;
                      return { serviceMetadata, layers };
                  });
              }
          }
      }
      get loading() {
          return this._loading;
      }
      async getGLStyleLayers() {
          if (this._glStylePromise) {
              return this._glStylePromise;
          }
          else {
              this._glStylePromise = new Promise(async (resolve, reject) => {
                  const { serviceMetadata, layers } = await this.getMetadata();
                  const layer = layers.layers.find((l) => l.id === this.layerId);
                  if (!layer) {
                      throw new Error("Layer not found");
                  }
                  resolve(styleForFeatureLayer(this.options.url.replace(/\/\d+$/, ""), this.layerId, this.sourceId, layer));
              });
              return this._glStylePromise;
          }
      }
      async addToMap(map) {
          this.map = map;
          this.QuantizedVectorRequestManager =
              getOrCreateQuantizedVectorRequestManager(map);
          await this.getMetadata();
          const { attribution } = await this.getComputedProperties();
          map.addSource(this.sourceId, {
              type: "geojson",
              data: this.featureData || {
                  type: "FeatureCollection",
                  features: [],
              },
              attribution: attribution ? attribution : "",
          });
          this._loading = this.featureData ? false : true;
          if (!this.rawFeaturesHaveBeenFetched) {
              this.fetchFeatures();
          }
          return this.sourceId;
      }
      async fetchFeatures() {
          var _a;
          if (this.exceededBytesLimit) {
              return;
          }
          try {
              const data = await fetchFeatureCollection(this.options.url, 6, "*", this.options.fetchStrategy === "raw"
                  ? 120000000
                  : this.options.autoFetchByteLimit || 2000000);
              this.featureData = data;
              const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
              if (source && source.type === "geojson") {
                  source.setData(data);
              }
              this._loading = false;
              this.rawFeaturesHaveBeenFetched = true;
          }
          catch (e) {
              let shouldFireError = true;
              if ("message" in e && /bytesLimit/.test(e.message)) {
                  this.exceededBytesLimit = true;
                  if (this.options.fetchStrategy === "auto") {
                      shouldFireError = false;
                      this.options.fetchStrategy = "quantized";
                      this.QuantizedVectorRequestManager.on("update", this.fetchTiles.bind(this));
                      this.fetchTiles();
                  }
              }
              if (shouldFireError) {
                  this.fireError(e);
                  console.error(e);
              }
              this._loading = false;
          }
      }
      async fetchTiles() {
          var _a;
          this._loading = true;
          if (!this.QuantizedVectorRequestManager) {
              throw new Error("QuantizedVectorRequestManager not initialized");
          }
          else if (this.options.fetchStrategy !== "quantized") {
              throw new Error("fetchTiles called when fetchStrategy is not quantized. Was " +
                  this.options.fetchStrategy);
          }
          const { tiles, tolerance } = this.QuantizedVectorRequestManager.viewPortDetails;
          console.log("fetchTiles", tiles);
          const fc = {
              type: "FeatureCollection",
              features: [],
          };
          const featureIds = new Set();
          console.log({ tiles, tolerance });
          await Promise.all(tiles.map((tile) => (async () => {
              const tileBounds = tilebelt.tileToBBOX(tile);
              const extent = {
                  spatialReference: {
                      latestWkid: 4326,
                      wkid: 4326,
                  },
                  xmin: tileBounds[0],
                  ymin: tileBounds[1],
                  xmax: tileBounds[2],
                  ymax: tileBounds[3],
              };
              const params = new URLSearchParams({
                  f: "pbf",
                  geometry: JSON.stringify(extent),
                  outFields: "*",
                  outSR: "4326",
                  returnZ: "false",
                  returnM: "false",
                  precision: "8",
                  where: "1=1",
                  setAttributionFromService: "true",
                  quantizationParameters: JSON.stringify({
                      extent,
                      tolerance,
                      mode: "view",
                  }),
                  resultType: "tile",
                  spatialRel: "esriSpatialRelIntersects",
                  geometryType: "esriGeometryEnvelope",
                  inSR: "4326",
                  ...this.options.queryParameters,
              });
              console.log("making request", params);
              return fetch(`${`${this.options.url}/query?${params.toString()}`}`)
                  .then((response) => response.arrayBuffer())
                  .then((data) => {
                  const collection = tileDecode(new Uint8Array(data)).featureCollection;
                  console.log("got response", collection);
                  for (const feature of collection.features) {
                      if (!featureIds.has(feature.id)) {
                          featureIds.add(feature.id);
                          fc.features.push(feature);
                      }
                  }
              })
                  .catch((e) => {
                  console.error(e);
              });
          })()));
          console.log("fetched tiles", fc);
          const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
          if (source && source.type === "geojson") {
              source.setData(fc);
          }
          this._loading = false;
      }
      async updateLayers(layerSettings) {
          if (this.map) {
              const layers = this.map.getStyle().layers || [];
              for (const layer of layers) {
                  if ("source" in layer && layer.source === this.sourceId) {
                      const visible = Boolean(layerSettings.find((l) => l.id === layer.source));
                      this.map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
                  }
              }
          }
      }
      async removeFromMap(map) {
          if (this.map) {
              const source = map.getSource(this.sourceId);
              if (source) {
                  const layers = map.getStyle().layers || [];
                  for (const layer of layers) {
                      if ("source" in layer && layer.source === this.sourceId) {
                          map.removeLayer(layer.id);
                      }
                  }
                  map.removeSource(this.sourceId);
              }
              this.map = undefined;
          }
      }
      destroy() {
          if (this.map) {
              this.removeFromMap(this.map);
          }
      }
  }

  function generateId() {
      return v4();
  }
  function createCanvas(w, h) {
      const canvas = document.createElement("canvas");
      canvas.setAttribute("width", w.toString());
      canvas.setAttribute("height", h.toString());
      return canvas;
  }
  const rgba = (color) => {
      color = color || [0, 0, 0, 0];
      return `rgba(${color[0]},${color[1]},${color[2]},${color[3] / 255})`;
  };
  const colorAndOpacity = (color) => {
      color = color || [0, 0, 0, 0];
      return {
          color: `rgb(${color[0]},${color[1]},${color[2]})`,
          opacity: color[3] / 255,
      };
  };
  const ptToPx = (pt) => Math.round(pt * 1.33);
  const ANCHORS = {
      esriServerPointLabelPlacementAboveCenter: "bottom",
      esriServerPointLabelPlacementAboveLeft: "bottom-right",
      esriServerPointLabelPlacementAboveRight: "bottom-left",
      esriServerPointLabelPlacementBelowCenter: "top",
      esriServerPointLabelPlacementBelowLeft: "top-right",
      esriServerPointLabelPlacementBelowRight: "top-left",
      esriServerPointLabelPlacementCenterCenter: "center",
      esriServerPointLabelPlacementCenterLeft: "right",
      esriServerPointLabelPlacementCenterRight: "left",
      esriServerLinePlacementAboveAlong: "bottom",
      esriServerLinePlacementAboveBefore: "bottom-left",
      esriServerLinePlacementAboveStart: "bottom-left",
      esriServerLinePlacementAboveEnd: "bottom-right",
      esriServerLinePlacementBelowAfter: "top-right",
      esriServerLinePlacementBelowAlong: "top",
      esriServerLinePlacementBelowBefore: "top-left",
      esriServerLinePlacementBelowStart: "top-left",
      esriServerLinePlacementBelowEnd: "top-right",
      esriServerLinePlacementCenterAfter: "right",
      esriServerLinePlacementCenterAlong: "center",
      esriServerLinePlacementCenterBefore: "center-left",
      esriServerLinePlacementCenterStart: "center-left",
      esriServerLinePlacementCenterEnd: "center-right",
      esriServerPolygonPlacementAlwaysHorizontal: "center",
  };
  const toTextAnchor = (labelPlacement) => ANCHORS[labelPlacement] || "center";

  const patterns = {
      esriSLSDash: (strokeWidth) => [2, 0.5],
      esriSLSDashDot: (strokeWidth) => [3, 1, 1, 1],
      esriSLSDashDotDot: (strokeWidth) => [3, 1, 1, 1, 1, 1],
      esriSLSNull: () => [0, 10],
      esriSLSDot: (strokeWidth) => [1, 1],
  };

  var esriSLS = (symbol, sourceId) => {
      const { color, opacity } = colorAndOpacity(symbol.color);
      let strokeWidth = ptToPx(symbol.width || 1);
      if (strokeWidth === -1) {
          strokeWidth = 1;
      }
      const style = symbol.style || "esriSLSSolid";
      const layer = {
          id: generateId(),
          type: "line",
          paint: {
              "line-color": color,
              "line-opacity": opacity,
              "line-width": strokeWidth,
          },
          layout: {},
          source: sourceId,
      };
      if (style !== "esriSLSSolid") {
          layer.paint["line-dasharray"] = patterns[style](strokeWidth);
      }
      return [layer];
  };

  var esriSFS = (symbol, sourceId, imageList) => {
      const layers = [];
      let useFillOutlineColor = symbol.outline &&
          ptToPx(symbol.outline.width || 1) === 1 &&
          symbol.outline.style === "esriSLSSolid";
      switch (symbol.style) {
          case "esriSFSSolid":
              if (symbol.color && symbol.color[3] === 0) {
                  useFillOutlineColor = false;
              }
              else {
                  layers.push({
                      id: generateId(),
                      type: "fill",
                      source: sourceId,
                      paint: {
                          "fill-color": rgba(symbol.color),
                          ...(useFillOutlineColor
                              ? { "fill-outline-color": rgba(symbol.outline.color) }
                              : {}),
                      },
                  });
              }
              break;
          case "esriSFSNull":
              break;
          case "esriSFSBackwardDiagonal":
          case "esriSFSCross":
          case "esriSFSDiagonalCross":
          case "esriSFSForwardDiagonal":
          case "esriSFSHorizontal":
          case "esriSFSVertical":
              const imageId = imageList.addEsriSFS(symbol);
              layers.push({
                  id: generateId(),
                  source: sourceId,
                  type: "fill",
                  paint: {
                      "fill-pattern": imageId,
                      ...(useFillOutlineColor
                          ? { "fill-outline-color": rgba(symbol.outline.color) }
                          : {}),
                  },
              });
              break;
          default:
              throw new Error(`Unknown fill style ${symbol.style}`);
      }
      if (symbol.outline && !useFillOutlineColor) {
          let outline = esriSLS(symbol.outline, sourceId);
          layers.push(...outline);
      }
      return layers;
  };

  var esriPMS = (symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) => {
      const imageId = imageList.addEsriPMS(symbol, serviceBaseUrl, sublayer, legendIndex);
      return [
          {
              id: generateId(),
              source: sourceId,
              type: "symbol",
              paint: {},
              layout: {
                  "icon-allow-overlap": true,
                  "icon-rotate": symbol.angle || 0,
                  "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
                  "icon-image": imageId,
              },
          },
      ];
  };

  var esriSMS = (symbol, sourceId, imageList) => {
      const imageId = imageList.addEsriSMS(symbol);
      return [
          {
              id: generateId(),
              type: "symbol",
              source: sourceId,
              paint: {},
              layout: {
                  "icon-allow-overlap": true,
                  "icon-rotate": symbol.angle,
                  "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
                  "icon-image": imageId,
                  "icon-size": 1,
              },
          },
      ];
  };

  var esriPFS = (symbol, sourceId, imageList) => {
      const imageId = imageList.addEsriPFS(symbol);
      const layers = [
          {
              id: generateId(),
              source: sourceId,
              type: "fill",
              paint: {
                  "fill-pattern": imageId,
              },
              layout: {},
          },
      ];
      if ("outline" in symbol) {
          let outline = esriSLS(symbol.outline, sourceId);
          layers.push(...outline);
      }
      return layers;
  };

  function symbolToLayers(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) {
      var layers;
      switch (symbol.type) {
          case "esriSFS":
              layers = esriSFS(symbol, sourceId, imageList);
              break;
          case "esriPFS":
              layers = esriPFS(symbol, sourceId, imageList);
              break;
          case "esriSLS":
              layers = esriSLS(symbol, sourceId);
              break;
          case "esriPMS":
              layers = esriPMS(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex);
              break;
          case "esriSMS":
              layers = esriSMS(symbol, sourceId, imageList);
              break;
          default:
              throw new Error(`Unknown symbol type ${symbol.type}`);
      }
      return layers;
  }

  function drawSMS (symbol, pixelRatio) {
      var _a, _b;
      const size = ptToPx(symbol.size || 13);
      const scale = 2 ** (pixelRatio - 1);
      const width = (size + 1 * 2 + (((_a = symbol.outline) === null || _a === void 0 ? void 0 : _a.width) || 0) * 2) * scale;
      const height = width;
      let canvas = createCanvas(width, height);
      var ctx = canvas.getContext("2d");
      ctx.lineWidth =
          ptToPx(!!symbol.outline ? symbol.outline.width || 1 : 1) * scale;
      ctx.strokeStyle = !!symbol.outline
          ? rgba((_b = symbol.outline) === null || _b === void 0 ? void 0 : _b.color)
          : rgba(symbol.color);
      ctx.fillStyle = rgba(symbol.color);
      switch (symbol.style) {
          case "esriSMSCircle":
              ctx.beginPath();
              var x = width / 2;
              var y = height / 2;
              var diameter = size * scale;
              var radius = Math.round((diameter + ctx.lineWidth) / 2);
              ctx.arc(x, y, radius, 0, Math.PI * 2, true);
              ctx.fill();
              ctx.stroke();
              break;
          case "esriSMSCross":
              var w = size * scale;
              ctx.lineWidth = Math.round(w / 4);
              ctx.strokeStyle = rgba(symbol.color);
              ctx.moveTo(width / 2, (height - w) / 2);
              ctx.lineTo(width / 2, height - (height - w) / 2);
              ctx.moveTo((width - w) / 2, height / 2);
              ctx.lineTo(width - (width - w) / 2, height / 2);
              ctx.stroke();
              ctx.fill();
              break;
          case "esriSMSX":
              var w = size * scale;
              ctx.translate(width / 2, height / 2);
              ctx.rotate((45 * Math.PI) / 180);
              ctx.translate(-width / 2, -height / 2);
              ctx.moveTo(width / 2, (height - w) / 2);
              ctx.lineTo(width / 2, height - (height - w) / 2);
              ctx.moveTo((width - w) / 2, height / 2);
              ctx.lineTo(width - (width - w) / 2, height / 2);
              ctx.stroke();
              ctx.fill();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              break;
          case "esriSMSDiamond":
              var w = size * scale;
              var h = w;
              var x = width / 2 - w / 2;
              var y = height / 2 - h / 2;
              ctx.translate(x + w / 2, y + h / 2);
              ctx.rotate((45 * Math.PI) / 180);
              ctx.fillRect(-w / 2, -h / 2, w, h);
              ctx.strokeRect(-w / 2, -h / 2, w, h);
              break;
          case "esriSMSSquare":
              var w = size * scale;
              var h = w;
              var x = width / 2 - w / 2;
              var y = height / 2 - h / 2;
              ctx.fillRect(x, y, w, h);
              ctx.strokeRect(x, y, w, h);
              break;
          case "esriSMSTriangle":
              ctx.beginPath();
              var w = size * scale;
              var h = w;
              var midpoint = width / 2;
              var x1 = midpoint;
              var y1 = (height - width) / 2;
              var x2 = width - (width - width) / 2;
              var y2 = height - (height - width) / 2;
              var x3 = (width - width) / 2;
              var y3 = height - (height - width) / 2;
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.lineTo(x3, y3);
              ctx.lineTo(x1, y1);
              ctx.fill();
              ctx.stroke();
              break;
          default:
              throw new Error(`Unknown symbol type ${symbol.style}`);
      }
      return { width, height, data: canvas.toDataURL() };
  }

  var fillPatterns = {
      esriSFSVertical: (strokeStyle = "#000000") => {
          var canvas = createCanvas(16, 16);
          var ctx = canvas.getContext("2d");
          ctx.strokeStyle = strokeStyle || "#000000";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(8, 16);
          ctx.stroke();
          return ctx.createPattern(canvas, "repeat");
      },
      esriSFSHorizontal: (strokeStyle = "#000000") => {
          var canvas = createCanvas(16, 16);
          var ctx = canvas.getContext("2d");
          ctx.strokeStyle = strokeStyle || "#000000";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.lineTo(16, 8);
          ctx.stroke();
          return ctx.createPattern(canvas, "repeat");
      },
      esriSFSBackwardDiagonal: (strokeStyle = "#000000") => {
          var canvas = createCanvas(16, 16);
          var ctx = canvas.getContext("2d");
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.lineTo(8, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, 24);
          ctx.lineTo(24, 0);
          ctx.stroke();
          return ctx.createPattern(canvas, "repeat");
      },
      esriSFSForwardDiagonal: (strokeStyle = "#000000") => {
          var canvas = createCanvas(16, 16);
          var ctx = canvas.getContext("2d");
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.lineTo(8, 16);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(16, 8);
          ctx.stroke();
          return ctx.createPattern(canvas, "repeat");
      },
      esriSFSCross: (strokeStyle = "#000000") => {
          var canvas = createCanvas(16, 16);
          var ctx = canvas.getContext("2d");
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.lineTo(16, 8);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(8, 16);
          ctx.stroke();
          return ctx.createPattern(canvas, "repeat");
      },
      esriSFSDiagonalCross: (strokeStyle = "#000000") => {
          var canvas = createCanvas(16, 16);
          var ctx = canvas.getContext("2d");
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.lineTo(8, 16);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(16, 8);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.lineTo(8, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, 24);
          ctx.lineTo(24, 0);
          ctx.stroke();
          return ctx.createPattern(canvas, "repeat");
      },
  };

  class ImageList {
      constructor(arcGISVersion, imageSets) {
          this.imageSets = [];
          this.supportsHighDPILegends = false;
          if (arcGISVersion && arcGISVersion >= 10.6) {
              this.supportsHighDPILegends = true;
          }
          if (imageSets) {
              this.imageSets = imageSets;
          }
      }
      toJSON() {
          return this.imageSets;
      }
      addEsriPFS(symbol) {
          const imageid = v4();
          this.imageSets.push({
              id: imageid,
              images: [
                  {
                      pixelRatio: 1,
                      dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
                      width: ptToPx(symbol.width),
                      height: ptToPx(symbol.height),
                  },
              ],
          });
          return imageid;
      }
      addEsriPMS(symbol, serviceBaseUrl, sublayer, legendIndex) {
          const imageid = v4();
          if (this.supportsHighDPILegends) {
              this.imageSets.push(new Promise(async (resolve) => {
                  const imageSet = {
                      id: imageid,
                      images: [
                          {
                              pixelRatio: 1,
                              dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
                              width: ptToPx(symbol.width),
                              height: ptToPx(symbol.height),
                          },
                      ],
                  };
                  if (/MapServer/.test(serviceBaseUrl)) {
                      const legend2x = await fetchLegendImage(serviceBaseUrl, sublayer, legendIndex, 2);
                      const legend3x = await fetchLegendImage(serviceBaseUrl, sublayer, legendIndex, 3);
                      imageSet.images.push(legend2x, legend3x);
                  }
                  resolve(imageSet);
              }));
          }
          else {
              this.imageSets.push({
                  id: imageid,
                  images: [
                      {
                          pixelRatio: 1,
                          dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
                          width: ptToPx(symbol.width),
                          height: ptToPx(symbol.height),
                      },
                  ],
              });
          }
          return imageid;
      }
      addEsriSMS(symbol) {
          const imageid = v4();
          const images = [1, 2, 3].map((pixelRatio) => {
              const marker = drawSMS(symbol, pixelRatio);
              return {
                  dataURI: marker.data,
                  pixelRatio,
                  width: marker.width,
                  height: marker.height,
              };
          });
          this.imageSets.push({
              id: imageid,
              images: images,
          });
          return imageid;
      }
      addEsriSFS(symbol) {
          const imageId = v4();
          const pattern = fillPatterns[symbol.style](rgba(symbol.color));
          this.imageSets.push({
              id: imageId,
              images: [
                  createFillImage(pattern, 1),
                  createFillImage(pattern, 2),
                  createFillImage(pattern, 3),
              ],
          });
          return imageId;
      }
      addToMap(map) {
          return Promise.all(this.imageSets.map(async (imageSet) => {
              if (imageSet instanceof Promise) {
                  imageSet = await imageSet;
              }
              let imageData = imageSet.images[0];
              if (imageSet.images.length > 1) {
                  imageData =
                      imageSet.images.find((i) => i.pixelRatio === Math.round(window.devicePixelRatio)) || imageData;
              }
              const image = await createImage(imageData.width, imageData.height, imageData.dataURI);
              map.addImage(imageSet.id, image, {
                  pixelRatio: imageData.pixelRatio,
              });
          }));
      }
      removeFromMap(map) {
          return Promise.all(this.imageSets.map(async (imageSet) => {
              if (imageSet instanceof Promise) {
                  imageSet = await imageSet;
              }
              map.removeImage(imageSet.id);
          }));
      }
  }
  async function createImage(width, height, dataURI) {
      return new Promise((resolve) => {
          const image = new Image(width, height);
          image.src = dataURI;
          image.onload = () => {
              resolve(image);
          };
      });
  }
  function createFillImage(pattern, pixelRatio) {
      const size = 4 * 2 ** pixelRatio;
      const canvas = document.createElement("canvas");
      canvas.setAttribute("width", size.toString());
      canvas.setAttribute("height", size.toString());
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = pattern;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(size, size);
      ctx.lineTo(size, 0);
      ctx.closePath();
      ctx.fill();
      return {
          pixelRatio,
          dataURI: canvas.toDataURL(),
          width: size,
          height: size,
      };
  }
  const cache = {};
  async function fetchLegendImage(serviceRoot, sublayer, legendIndex, pixelRatio) {
      const legendData = await fetchLegendData(serviceRoot, pixelRatio);
      console.log("legendData", serviceRoot, legendData);
      const sublayerData = legendData.layers.find((lyr) => lyr.layerId === sublayer);
      const legendItem = sublayerData.legend[legendIndex];
      return {
          dataURI: `data:${legendItem.contentType};base64,${legendItem.imageData}`,
          pixelRatio,
          width: legendItem.width,
          height: legendItem.height,
      };
  }
  async function fetchLegendData(serviceRoot, pixelRatio) {
      const dpi = pixelRatio === 2 ? 192 : 384;
      if (!cache[serviceRoot]) {
          cache[serviceRoot] = {};
      }
      if (!cache[serviceRoot][pixelRatio]) {
          cache[serviceRoot][pixelRatio] = fetch(`${serviceRoot}/legend?f=json&dpi=${dpi}`).then((r) => r.json());
      }
      return cache[serviceRoot][pixelRatio];
  }

  var esriTS = (labelingInfo, geometryType, fieldNames) => {
      return {
          id: generateId(),
          type: "symbol",
          layout: {
              "text-field": toExpression(labelingInfo.labelExpression, fieldNames),
              "text-anchor": toTextAnchor(labelingInfo.labelPlacement),
              "text-size": ptToPx(labelingInfo.symbol.font.size || 13),
              "symbol-placement": geometryType === "line" ? "line" : "point",
              "text-max-angle": 20,
          },
          paint: {
              "text-color": rgba(labelingInfo.symbol.color),
              "text-halo-width": ptToPx(labelingInfo.symbol.haloSize || 0),
              "text-halo-color": rgba(labelingInfo.symbol.haloColor || [255, 255, 255, 255]),
              "text-halo-blur": ptToPx(labelingInfo.symbol.haloSize || 0) * 0.5,
          },
      };
  };
  function toExpression(labelExpression, fieldNames) {
      const fields = (labelExpression.match(/\[\w+\]/g) || [])
          .map((val) => val.replace(/[\[\]]/g, ""))
          .map((val) => fieldNames.find((name) => name.toLowerCase() === val.toLowerCase()));
      const strings = labelExpression.split(/\[\w+\]/g);
      const expression = ["format"];
      while (strings.length) {
          expression.push(strings.shift());
          const field = fields.shift();
          if (field) {
              expression.push(["get", field]);
          }
      }
      return expression;
  }

  async function styleForFeatureLayer(serviceBaseUrl, sublayer, sourceId, serviceMetadata) {
      serviceBaseUrl = serviceBaseUrl.replace(/\/$/, "");
      const url = `${serviceBaseUrl}/${sublayer}`;
      serviceMetadata =
          serviceMetadata || (await fetch(url + "?f=json").then((r) => r.json()));
      const renderer = serviceMetadata.drawingInfo.renderer;
      let layers = [];
      const imageList = new ImageList(serviceMetadata.currentVersion);
      let legendItemIndex = 0;
      switch (renderer.type) {
          case "uniqueValue": {
              const fields = [renderer.field1];
              if (renderer.field2) {
                  fields.push(renderer.field2);
                  if (renderer.field3) {
                      fields.push(renderer.field3);
                  }
              }
              const filters = [];
              const field = renderer.field1;
              legendItemIndex = renderer.defaultSymbol ? 1 : 0;
              const fieldTypes = fields.map((f) => {
                  const fieldRecord = serviceMetadata.fields.find((r) => r.name === f);
                  return FIELD_TYPES[fieldRecord === null || fieldRecord === void 0 ? void 0 : fieldRecord.type] || "string";
              });
              for (const info of renderer.uniqueValueInfos) {
                  const values = normalizeValuesForFieldTypes(info.value, renderer.fieldDelimiter, fieldTypes);
                  layers.push(...symbolToLayers(info.symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendItemIndex++).map((lyr) => {
                      var _a;
                      if ((_a = info.label) === null || _a === void 0 ? void 0 : _a.length) {
                          lyr.metadata = { label: info.label };
                      }
                      if (fields.length === 1) {
                          lyr.filter = ["==", field, values[0]];
                          filters.push(lyr.filter);
                      }
                      else {
                          lyr.filter = [
                              "all",
                              ...fields.map((field) => [
                                  "==",
                                  field,
                                  values[fields.indexOf(field)],
                              ]),
                          ];
                          filters.push(lyr.filter);
                      }
                      return lyr;
                  }));
              }
              if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
                  layers.push(...symbolToLayers(renderer.defaultSymbol, sourceId, imageList, serviceBaseUrl, sublayer, 0).map((lyr) => {
                      lyr.filter = ["!", ["any", ...filters]];
                      lyr.metadata = { label: "Default" };
                      return lyr;
                  }));
              }
              break;
          }
          case "classBreaks":
              console.log("class breaks", renderer.classBreakInfos);
              if (renderer.backgroundFillSymbol) {
                  layers.push(...symbolToLayers(renderer.backgroundFillSymbol, sourceId, imageList, serviceBaseUrl, sublayer, 0));
              }
              const field = renderer.field;
              const filters = [];
              legendItemIndex = renderer.classBreakInfos.length - 1;
              let minValue = 0;
              console.log("renderer", renderer);
              const minMaxValues = renderer.classBreakInfos.map((b) => {
                  const values = [b.classMinValue || minValue, b.classMaxValue];
                  minValue = values[1];
                  return values;
              });
              for (const info of [...renderer.classBreakInfos].reverse()) {
                  layers.push(...symbolToLayers(info.symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendItemIndex--).map((lyr) => {
                      var _a;
                      const [min, max] = minMaxValues[renderer.classBreakInfos.indexOf(info)];
                      if (renderer.classBreakInfos.indexOf(info) === 0) {
                          lyr.filter = ["all", ["<=", field, max]];
                      }
                      else {
                          lyr.filter = ["all", [">", field, min], ["<=", field, max]];
                      }
                      if ((_a = info.label) === null || _a === void 0 ? void 0 : _a.length) {
                          lyr.metadata = { label: info.label };
                      }
                      filters.push(lyr.filter);
                      return lyr;
                  }));
              }
              if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
                  const defaultLayers = await symbolToLayers(renderer.defaultSymbol, sourceId, imageList, serviceBaseUrl, sublayer, 0);
                  for (const index in defaultLayers) {
                      defaultLayers[index].filter = ["none", filters];
                      defaultLayers[index].metadata = { label: "Default" };
                  }
                  layers.push(...defaultLayers);
              }
              break;
          default:
              layers = symbolToLayers(renderer.symbol, sourceId, imageList, serviceBaseUrl, sublayer, 0);
              break;
      }
      if (serviceMetadata.drawingInfo.labelingInfo) {
          for (const info of serviceMetadata.drawingInfo.labelingInfo) {
              if (info.labelExpression) {
                  const layer = esriTS(info, serviceMetadata.geometryType, serviceMetadata.fields.map((f) => f.name));
                  layer.source = sourceId;
                  layer.id = generateId();
                  layers.push(layer);
              }
          }
      }
      return {
          imageList,
          layers,
      };
  }
  function normalizeValuesForFieldTypes(value, delimiter, fieldTypes) {
      const values = value.split(delimiter);
      return values.map((v, i) => {
          if (fieldTypes[i] === "string") {
              return v;
          }
          else if (fieldTypes[i] === "integer") {
              return parseInt(v);
          }
          else if (fieldTypes[i] === "float") {
              return parseFloat(v);
          }
      });
  }
  const FIELD_TYPES = {
      esriFieldTypeSmallInteger: "integer",
      esriFieldTypeInteger: "integer",
      esriFieldTypeSingle: "float",
      esriFieldTypeDouble: "float",
      esriFieldTypeString: "string",
      esriFieldTypeDate: "string",
      esriFieldTypeOID: "integer",
      esriFieldTypeGeometry: "string",
      esriFieldTypeBlob: "string",
      esriFieldTypeRaster: "string",
      esriFieldTypeGUID: "string",
      esriFieldTypeGlobalID: "string",
      esriFieldTypeXML: "string",
  };

  exports.ArcGISDynamicMapService = ArcGISDynamicMapService;
  exports.ArcGISFeatureLayerSource = ArcGISFeatureLayerSource;
  exports.ArcGISRESTServiceRequestManager = ArcGISRESTServiceRequestManager;
  exports.ArcGISTiledMapService = ArcGISTiledMapService;
  exports.ArcGISVectorSource = ArcGISVectorSource;
  exports.ImageList = ImageList;
  exports.styleForFeatureLayer = styleForFeatureLayer;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({});
