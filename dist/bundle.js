var MapBoxGLEsriSources = (function (exports) {
    'use strict';

    const blankDataUri = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
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
    class ArcGISDynamicMapService {
        /**
         * @param {Map} map MapBox GL JS Map instance
         * @param {string} id ID to be used when adding refering to this source from layers
         * @param {string} baseUrl Location of the service. Should end in /MapServer
         * @param {ArcGISDynamicMapServiceOptions} [options]
         */
        constructor(map, id, baseUrl, options) {
            this.supportDevicePixelRatio = true;
            this.supportsDynamicLayers = false;
            this.updateSource = () => {
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
            };
            this.id = id;
            this.baseUrl = baseUrl;
            this.url = new URL(this.baseUrl + "/export");
            this.url.searchParams.set("f", "image");
            this.map = map;
            this.map.on("moveend", this.updateSource);
            this.layers = options === null || options === void 0 ? void 0 : options.layers;
            this.queryParameters = {
                transparent: "true",
                ...((options === null || options === void 0 ? void 0 : options.queryParameters) || {}),
            };
            if (options && "useDevicePixelRatio" in options) {
                this.supportDevicePixelRatio = !!options.useDevicePixelRatio;
            }
            matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addListener(() => {
                if (this.supportDevicePixelRatio) {
                    this.updateSource();
                }
            });
            this.supportsDynamicLayers = (options === null || options === void 0 ? void 0 : options.supportsDynamicLayers) || false;
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
            this.source = this.map.getSource(this.id);
        }
        /**
         * Clears all map event listeners setup by this instance.
         */
        destroy() {
            this.map.off("moveend", this.updateSource);
        }
        getUrl() {
            const bounds = this.map.getBounds();
            // create bbox in web mercator
            let bbox = [
                lon2meters(bounds.getWest()),
                lat2meters(bounds.getSouth()),
                lon2meters(bounds.getEast()),
                lat2meters(bounds.getNorth()),
            ];
            const groundResolution = getGroundResolution(this.map.getZoom() +
                (this.supportDevicePixelRatio ? window.devicePixelRatio - 1 : 0));
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
                        this.url.searchParams.set("dpi", 
                        // Bumping pixel ratio a bit. see above
                        (window.devicePixelRatio * 96 * 1.22).toString());
                        break;
                }
            }
            else {
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
                }
                else {
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
                }
                else {
                    this.url.searchParams.set("layers", `show:${this.layers.map((lyr) => lyr.sublayer).join(",")}`);
                }
            }
            this.url.searchParams.set("bbox", bbox.join(","));
            this.url.searchParams.delete("dynamicLayers");
            let layersInOrder = true;
            let hasOpacityUpdates = false;
            if (this.supportsDynamicLayers && this.layers) {
                for (var i = 0; i < this.layers.length; i++) {
                    if (this.layers[i - 1] &&
                        this.layers[i].sublayer < this.layers[i - 1].sublayer) {
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
                            transparency: lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
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
        updateLayers(layers) {
            this.layers = layers;
            this.updateSource();
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
        updateQueryParameters(queryParameters) {
            this.queryParameters = queryParameters;
            this.updateSource();
        }
        /**
         * Update support for adjusting image resolution based on devicePixelRatio and
         * re-render the map. Useful for giving users the option to toggle
         * high-resolution images depending on network conditions.
         * @param enable
         */
        updateUseDevicePixelRatio(enable) {
            this.supportDevicePixelRatio = enable;
            this.updateSource();
        }
    }
    function lat2meters(lat) {
        // thanks! https://gist.github.com/onderaltintas/6649521
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

    /* @preserve
    * @terraformer/arcgis - v2.0.6 - MIT
    * Copyright (c) 2012-2020 Environmental Systems Research Institute, Inc.
    * Mon May 18 2020 14:30:35 GMT-0700 (Pacific Daylight Time)
    */
    /* Copyright (c) 2012-2019 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */

    var edgeIntersectsEdge = function edgeIntersectsEdge(a1, a2, b1, b2) {
      var uaT = (b2[0] - b1[0]) * (a1[1] - b1[1]) - (b2[1] - b1[1]) * (a1[0] - b1[0]);
      var ubT = (a2[0] - a1[0]) * (a1[1] - b1[1]) - (a2[1] - a1[1]) * (a1[0] - b1[0]);
      var uB = (b2[1] - b1[1]) * (a2[0] - a1[0]) - (b2[0] - b1[0]) * (a2[1] - a1[1]);

      if (uB !== 0) {
        var ua = uaT / uB;
        var ub = ubT / uB;

        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
          return true;
        }
      }

      return false;
    };
    var coordinatesContainPoint = function coordinatesContainPoint(coordinates, point) {
      var contains = false;

      for (var i = -1, l = coordinates.length, j = l - 1; ++i < l; j = i) {
        if ((coordinates[i][1] <= point[1] && point[1] < coordinates[j][1] || coordinates[j][1] <= point[1] && point[1] < coordinates[i][1]) && point[0] < (coordinates[j][0] - coordinates[i][0]) * (point[1] - coordinates[i][1]) / (coordinates[j][1] - coordinates[i][1]) + coordinates[i][0]) {
          contains = !contains;
        }
      }

      return contains;
    };
    var pointsEqual = function pointsEqual(a, b) {
      for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }

      return true;
    };
    var arrayIntersectsArray = function arrayIntersectsArray(a, b) {
      for (var i = 0; i < a.length - 1; i++) {
        for (var j = 0; j < b.length - 1; j++) {
          if (edgeIntersectsEdge(a[i], a[i + 1], b[j], b[j + 1])) {
            return true;
          }
        }
      }

      return false;
    };

    /* Copyright (c) 2012-2019 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */

    var closeRing = function closeRing(coordinates) {
      if (!pointsEqual(coordinates[0], coordinates[coordinates.length - 1])) {
        coordinates.push(coordinates[0]);
      }

      return coordinates;
    }; // determine if polygon ring coordinates are clockwise. clockwise signifies outer ring, counter-clockwise an inner ring
    // or hole. this logic was found at http://stackoverflow.com/questions/1165647/how-to-determine-if-a-list-of-polygon-
    // points-are-in-clockwise-order

    var ringIsClockwise = function ringIsClockwise(ringToTest) {
      var total = 0;
      var i = 0;
      var rLength = ringToTest.length;
      var pt1 = ringToTest[i];
      var pt2;

      for (i; i < rLength - 1; i++) {
        pt2 = ringToTest[i + 1];
        total += (pt2[0] - pt1[0]) * (pt2[1] + pt1[1]);
        pt1 = pt2;
      }

      return total >= 0;
    }; // This function ensures that rings are oriented in the right directions
    // from http://jsperf.com/cloning-an-object/2

    var shallowClone = function shallowClone(obj) {
      var target = {};

      for (var i in obj) {
        // both arcgis attributes and geojson props are just hardcoded keys
        if (obj.hasOwnProperty(i)) {
          // eslint-disable-line no-prototype-builtins
          target[i] = obj[i];
        }
      }

      return target;
    };

    /* Copyright (c) 2012-2019 Environmental Systems Research Institute, Inc.
     * Apache-2.0 */

    var coordinatesContainCoordinates = function coordinatesContainCoordinates(outer, inner) {
      var intersects = arrayIntersectsArray(outer, inner);
      var contains = coordinatesContainPoint(outer, inner[0]);

      if (!intersects && contains) {
        return true;
      }

      return false;
    }; // do any polygons in this array contain any other polygons in this array?
    // used for checking for holes in arcgis rings


    var convertRingsToGeoJSON = function convertRingsToGeoJSON(rings) {
      var outerRings = [];
      var holes = [];
      var x; // iterator

      var outerRing; // current outer ring being evaluated

      var hole; // current hole being evaluated
      // for each ring

      for (var r = 0; r < rings.length; r++) {
        var ring = closeRing(rings[r].slice(0));

        if (ring.length < 4) {
          continue;
        } // is this ring an outer ring? is it clockwise?


        if (ringIsClockwise(ring)) {
          var polygon = [ring.slice().reverse()]; // wind outer rings counterclockwise for RFC 7946 compliance

          outerRings.push(polygon); // push to outer rings
        } else {
          holes.push(ring.slice().reverse()); // wind inner rings clockwise for RFC 7946 compliance
        }
      }

      var uncontainedHoles = []; // while there are holes left...

      while (holes.length) {
        // pop a hole off out stack
        hole = holes.pop(); // loop over all outer rings and see if they contain our hole.

        var contained = false;

        for (x = outerRings.length - 1; x >= 0; x--) {
          outerRing = outerRings[x][0];

          if (coordinatesContainCoordinates(outerRing, hole)) {
            // the hole is contained push it into our polygon
            outerRings[x].push(hole);
            contained = true;
            break;
          }
        } // ring is not contained in any outer ring
        // sometimes this happens https://github.com/Esri/esri-leaflet/issues/320


        if (!contained) {
          uncontainedHoles.push(hole);
        }
      } // if we couldn't match any holes using contains we can try intersects...


      while (uncontainedHoles.length) {
        // pop a hole off out stack
        hole = uncontainedHoles.pop(); // loop over all outer rings and see if any intersect our hole.

        var intersects = false;

        for (x = outerRings.length - 1; x >= 0; x--) {
          outerRing = outerRings[x][0];

          if (arrayIntersectsArray(outerRing, hole)) {
            // the hole is contained push it into our polygon
            outerRings[x].push(hole);
            intersects = true;
            break;
          }
        }

        if (!intersects) {
          outerRings.push([hole.reverse()]);
        }
      }

      if (outerRings.length === 1) {
        return {
          type: 'Polygon',
          coordinates: outerRings[0]
        };
      } else {
        return {
          type: 'MultiPolygon',
          coordinates: outerRings
        };
      }
    };

    var getId = function getId(attributes, idAttribute) {
      var keys = idAttribute ? [idAttribute, 'OBJECTID', 'FID'] : ['OBJECTID', 'FID'];

      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];

        if (key in attributes && (typeof attributes[key] === 'string' || typeof attributes[key] === 'number')) {
          return attributes[key];
        }
      }

      throw Error('No valid id attribute found');
    };

    var arcgisToGeoJSON = function arcgisToGeoJSON(arcgis, idAttribute) {
      var geojson = {};

      if (arcgis.features) {
        geojson.type = 'FeatureCollection';
        geojson.features = [];

        for (var i = 0; i < arcgis.features.length; i++) {
          geojson.features.push(arcgisToGeoJSON(arcgis.features[i], idAttribute));
        }
      }

      if (typeof arcgis.x === 'number' && typeof arcgis.y === 'number') {
        geojson.type = 'Point';
        geojson.coordinates = [arcgis.x, arcgis.y];

        if (typeof arcgis.z === 'number') {
          geojson.coordinates.push(arcgis.z);
        }
      }

      if (arcgis.points) {
        geojson.type = 'MultiPoint';
        geojson.coordinates = arcgis.points.slice(0);
      }

      if (arcgis.paths) {
        if (arcgis.paths.length === 1) {
          geojson.type = 'LineString';
          geojson.coordinates = arcgis.paths[0].slice(0);
        } else {
          geojson.type = 'MultiLineString';
          geojson.coordinates = arcgis.paths.slice(0);
        }
      }

      if (arcgis.rings) {
        geojson = convertRingsToGeoJSON(arcgis.rings.slice(0));
      }

      if (typeof arcgis.xmin === 'number' && typeof arcgis.ymin === 'number' && typeof arcgis.xmax === 'number' && typeof arcgis.ymax === 'number') {
        geojson.type = 'Polygon';
        geojson.coordinates = [[[arcgis.xmax, arcgis.ymax], [arcgis.xmin, arcgis.ymax], [arcgis.xmin, arcgis.ymin], [arcgis.xmax, arcgis.ymin], [arcgis.xmax, arcgis.ymax]]];
      }

      if (arcgis.geometry || arcgis.attributes) {
        geojson.type = 'Feature';
        geojson.geometry = arcgis.geometry ? arcgisToGeoJSON(arcgis.geometry) : null;
        geojson.properties = arcgis.attributes ? shallowClone(arcgis.attributes) : null;

        if (arcgis.attributes) {
          try {
            geojson.id = getId(arcgis.attributes, idAttribute);
          } catch (err) {// don't set an id
          }
        }
      } // if no valid geometry was encountered


      if (JSON.stringify(geojson.geometry) === JSON.stringify({})) {
        geojson.geometry = null;
      }

      if (arcgis.spatialReference && arcgis.spatialReference.wkid && arcgis.spatialReference.wkid !== 4326) {
        console.warn('Object converted in non-standard crs - ' + JSON.stringify(arcgis.spatialReference));
      }

      return geojson;
    };

    // @ts-ignore
    const WORLD = { xmin: -180, xmax: 180, ymin: -90, ymax: 90 };
    /**
     * Add ArcGIS Feature Layers to MapBox GL JS maps as a geojson source. These
     * data sources can be styled using output from
     * {@link styleForFeatureLayer | styleForFeatureLayer } or custom layers that
     * reference the provided source id.
     *
     * ### Usage
     *
     * ```typescript
     * import { ArcGISVectorSource } from "mapbox-gl-esri-sources";
     *
     * // setup map...
     *
     * const esriSource = new ArcGISVectorSource(
     *   map,
     *   'cities-source-id',
     *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0"),
     *   {
     *     bytesLimit: 1000 * 1000 * 2, // 2mb
     *     geometryPrecision: 5,
     *     outFields: "POP,CITY_NAME"
     *   }
     * );
     * ```
     * @class ArcGISVectorSource
     */
    class ArcGISVectorSource {
        /**
         * Creates an instance of ArcGISVectorSource.
         * @param {Map} map MapBox GL JS map instance where source will be added
         * @param {string} id ID will be assigned to the GeoJSONSource instance
         * @param {string} url Base url for an [ArcGIS Server Feature Layer](https://developers.arcgis.com/rest/services-reference/layer-table.htm). Should end in _/MapServer/0..n_
         */
        constructor(map, id, url, options) {
            this.data = {
                type: "FeatureCollection",
                features: [],
            };
            /**
             * Size of the dataset added to the map. Relies on `content-length` header
             * from the data host, which may not be available.
             */
            this.totalBytes = 0;
            this.outFields = "*";
            this.supportsPagination = true;
            this.displayIncompleteFeatureCollections = true;
            this.id = id;
            this.baseUrl = url;
            this.options = options;
            this.map = map;
            this.map.addSource(this.id, {
                data: this.data,
                type: "geojson",
            });
            if (options &&
                "supportsPagination" in options &&
                options["supportsPagination"] === false) {
                this.supportsPagination = false;
            }
            if (options &&
                "displayIncompleteFeatureCollections" in options &&
                options["displayIncompleteFeatureCollections"] === false) {
                this.displayIncompleteFeatureCollections = false;
            }
            if (options && options.outFields) {
                this.outFields = options.outFields;
            }
            this.source = this.map.getSource(this.id);
            this.fetchGeoJSON();
        }
        async fetchGeoJSON() {
            var _a, _b, _c;
            if (((_a = this.options) === null || _a === void 0 ? void 0 : _a.bytesLimit) && this.options.bytesLimit < this.totalBytes) {
                throw new Error("Exceeded data transfer limit for this source");
            }
            const params = new URLSearchParams({
                inSR: "4326",
                outSR: "4326",
                geometry: JSON.stringify(WORLD),
                geometryType: "esriGeometryEnvelope",
                spatialRel: "esriSpatialRelIntersects",
                outFields: this.outFields,
                returnGeometry: "true",
                geometryPrecision: ((_c = (_b = this.options) === null || _b === void 0 ? void 0 : _b.geometryPrecision) === null || _c === void 0 ? void 0 : _c.toString()) || "6",
                returnIdsOnly: "false",
                // use json and convert rather than geojson. geojson endpoints don't
                // support gzip so are much less efficient
                f: "json",
                resultOffset: this.supportsPagination
                    ? this.data.features.length.toString()
                    : "",
            });
            const response = await fetch(`${this.baseUrl}/query?${params.toString()}`, {
                mode: "cors",
            });
            this.totalBytes += parseInt(response.headers.get("content-length") || "0");
            const esriJSON = await response.json();
            if (esriJSON.error) {
                if (this.supportsPagination &&
                    /pagination/i.test(esriJSON.error.message)) {
                    this.supportsPagination = false;
                    this.fetchGeoJSON();
                }
                else {
                    throw new Error(`Error retrieving feature data. ${esriJSON.error.message}`);
                }
            }
            else {
                const featureCollection = arcgisToGeoJSON(esriJSON);
                this.data = {
                    type: "FeatureCollection",
                    features: [...this.data.features, ...featureCollection.features],
                };
                if (esriJSON.exceededTransferLimit) {
                    if (this.supportsPagination === false) {
                        this.source.setData(this.data);
                        throw new Error("Data source does not support pagination but exceeds transfer limit");
                    }
                    else {
                        if (this.displayIncompleteFeatureCollections) {
                            this.source.setData(this.data);
                        }
                        this.fetchGeoJSON();
                    }
                }
                else {
                    this.source.setData(this.data);
                }
            }
        }
    }

    // Unique ID creation requires a high quality random # generator. In the browser we therefore
    // require the crypto API and do not support built-in fallback to lower quality random number
    // generators (like Math.random()).
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation. Also,
    // find the complete implementation of crypto (msCrypto) on IE11.
    var getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);
    var rnds8 = new Uint8Array(16);
    function rng() {
      if (!getRandomValues) {
        throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
      }

      return getRandomValues(rnds8);
    }

    var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

    function validate(uuid) {
      return typeof uuid === 'string' && REGEX.test(uuid);
    }

    /**
     * Convert array of 16 byte values to UUID string format of the form:
     * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
     */

    var byteToHex = [];

    for (var i = 0; i < 256; ++i) {
      byteToHex.push((i + 0x100).toString(16).substr(1));
    }

    function stringify(arr) {
      var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      // Note: Be careful editing this code!  It's been tuned for performance
      // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
      var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
      // of the following:
      // - One or more input array values don't map to a hex octet (leading to
      // "undefined" in the uuid)
      // - Invalid input values for the RFC `version` or `variant` fields

      if (!validate(uuid)) {
        throw TypeError('Stringified UUID is invalid');
      }

      return uuid;
    }

    function v4(options, buf, offset) {
      options = options || {};
      var rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

      rnds[6] = rnds[6] & 0x0f | 0x40;
      rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

      if (buf) {
        offset = offset || 0;

        for (var i = 0; i < 16; ++i) {
          buf[offset + i] = rnds[i];
        }

        return buf;
      }

      return stringify(rnds);
    }

    // @ts-ignore
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
        return `rgba(${color[0]},${color[1]},${color[2]},${color[3]})`;
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
        // Note that these are essentially backwards from what you'd expect
        // details: http://resources.arcgis.com/en/help/rest/apiref/index.html?renderer.html
        // https://www.mapbox.com/mapbox-gl-js/style-spec/#layout-symbol-text-anchor
        // Label Placement Values For Point Features
        esriServerPointLabelPlacementAboveCenter: "bottom",
        esriServerPointLabelPlacementAboveLeft: "bottom-right",
        esriServerPointLabelPlacementAboveRight: "bottom-left",
        esriServerPointLabelPlacementBelowCenter: "top",
        esriServerPointLabelPlacementBelowLeft: "top-right",
        esriServerPointLabelPlacementBelowRight: "top-left",
        esriServerPointLabelPlacementCenterCenter: "center",
        esriServerPointLabelPlacementCenterLeft: "right",
        esriServerPointLabelPlacementCenterRight: "left",
        // Label Placement Values For Line Features
        // esriServerLinePlacementAboveAfter
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
        // // Label Placement Values For Polygon Features
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
        // No idea why... but this matches map service image output
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
        switch (symbol.style) {
            case "esriSFSSolid":
                layers.push({
                    id: generateId(),
                    type: "fill",
                    source: sourceId,
                    paint: {
                        "fill-color": rgba(symbol.color),
                    },
                });
                break;
            case "esriSFSNull":
                // leave empty
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
                    },
                });
                break;
            default:
                throw new Error(`Unknown fill style ${symbol.style}`);
        }
        if (symbol.outline) {
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
                    "icon-rotate": symbol.angle,
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

    // TODO: Add support for lesser-used options
    // height
    // width
    // angle
    // xoffset
    // yoffset
    // xscale
    // yscale
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
                // canvas.style = "image-rendering: pixelated;";
                // ctx.imageSmoothingEnabled = false;
                ctx.beginPath();
                var x = width / 2;
                var y = height / 2;
                var diameter = size * scale;
                // I have no idea why, but adding a bit here helps match arcgis server output a bit better
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
        constructor(arcGISVersion) {
            this.imageSets = [];
            this.supportsHighDPILegends = false;
            if (arcGISVersion && arcGISVersion >= 10.6) {
                this.supportsHighDPILegends = true;
            }
        }
        /**
         * Add a fill image for a PictureFillSymbol to the image set.
         *
         * PictureFillSymbol images cannot be requested at high-dpi from the legend
         * endpoint because they would include an outline and not the full pattern. If
         * there is a way to request a high-dpi image I do not know it. Instead,
         * serialized image data is just pulled from the symbol itself.
         *
         * @hidden
         * @param {PictureFillSymbol} symbol
         * @returns {string} imageid
         */
        addEsriPFS(symbol) {
            const imageid = v4();
            console.log(symbol);
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
        /**
         * Add a PictureMarkerSymbol image to the set. If the server supports high-dpi
         * legends (10.6+), this function will fetch high resolution markers from the
         * origin server. Otherwise it will just use serialized image data from the
         * symbol definition.
         *
         * @param {PictureMarkerSymbol} symbol
         * @param {string} serviceBaseUrl
         * @param {number} sublayer
         * @param {number} legendIndex
         * @returns {string} imageid
         * @hidden
         */
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
                    const legend2x = await fetchLegendImage(serviceBaseUrl, sublayer, legendIndex, 2);
                    const legend3x = await fetchLegendImage(serviceBaseUrl, sublayer, legendIndex, 3);
                    imageSet.images.push(legend2x, legend3x);
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
        /**
         * Adds a SimpleMarkerSymbol to the ImageSet. These markers will be generated
         * in multiple resolutions using html canvas to support multiple device pixel
         * ratios (1, 2 and 3)
         *
         * @param {SimpleMarkerSymbol} symbol
         * @returns {string} imageid
         * @hidden
         */
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
        /**
         * @hidden
         * @param {SimpleFillSymbol} symbol
         * @returns
         * @memberof ImageList
         */
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
        /**
         * Add all images to a MapBox GL JS map instance so that they may be used in
         * style layers. Call before adding layers created by {@link styleForFeatureLayer | styleForFeatureLayer}.
         *
         * The ImageList may contain multiple copies of images at different dpi. Since
         * MapBox GL does not currently support adding images at multiple resolutions
         * this function will pick those that best match the current [devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio).
         * If the devicePixelRatio changes (e.g. switching monitors), the images
         * *will not* be updated and may be at a less than ideal resolution, though
         * mapbox gl will still show them at the correct size.
         *
         * @param {Map} map
         * @returns
         * @memberof ImageList
         */
        addToMap(map) {
            return Promise.all(this.imageSets.map(async (imageSet) => {
                if (imageSet instanceof Promise) {
                    imageSet = await imageSet;
                }
                let imageData = imageSet.images[0];
                // MapBox GL does not allow adding images with multiple copies for each
                // pixelRatio. So we have to pick the one that matches the current
                // devicePixelRatio. This may change during the user session and result
                // than a less than ideal display, but updating the image is a lot of
                // extra complexity to manage.
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
        // TODO: Support scale-dependant rendering. Right now just taking first label
        // TODO: labelExpressions (full Arcade!?)
        // TODO: where expressions
        // TODO: xoffset, yoffset, kerning, angle, rightToLeft, horizontalAlignment, etc
        // See https://developers.arcgis.com/documentation/common-data-types/labeling-objects.htm
        return {
            id: generateId(),
            type: "symbol",
            layout: {
                // TODO: properly support labeling functions like UCASE(), CONCAT(), etc
                // https://developers.arcgis.com/documentation/common-data-types/labeling-objects.htm
                "text-field": toExpression(labelingInfo.labelExpression, fieldNames),
                // Only supports points right now
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

    /**
     * This function retrieves rendering and style information from the ArcGIS REST
     * API for a given [Feature Layer](https://developers.arcgis.com/rest/services-reference/layer-table.htm)
     * and produces images and style layers that can be used to faithfully represent
     * these services as vectors in MapBox GL. It can be used in conjunction with
     * {@link ArcGISVectorSource | ArcGISVectorSource}.
     *
     * Style generation is seperated from source handling so that you could even
     * use tippecanoe or other tools to generate vector tiles from a service and
     * style them using the generated layers. With this seperation of concerns it's
     * also possible to cache style information so that it does not need to
     * always be generated dynamically.
     *
     * ### Usage
     *
     * ```typescript
     * import { ArcGISVectorSource, styleForFeatureLayer } from "mapbox-gl-esri-sources";
     *
     * // setup map...
     * // add source...
     *
     * const { imageList, layers } = styleForFeatureLayer(
     *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0",
     *   "cities-source-id"
     * );
     *
     * imageList.addToMap(map);
     *
     * for (const layer of layers) {
     *   map.addLayer(layer);
     * }
     *
     * ```
     *
     * @param {string} url Feature layer endpoint. Should terminate in _/MapServer/0..n_
     * @param {string} sourceId ID for the [source](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/) of vector data to be used in rendering.
     * @returns The {@link ImageList.addToMap | ImageList.addToMap(map)} function should be called before adding the generated layers to the map.
     */
    async function styleForFeatureLayer(url, sourceId) {
        const rootUrl = url.replace(/\/\d+[\/]*$/, "");
        const sublayer = parseInt(url.match(/\/(\d+)[\/]*$/)[1]);
        const response = await fetch(url + "?f=json").then((r) => r.json());
        const renderer = response.drawingInfo.renderer;
        let layers = [];
        const imageList = new ImageList(response.currentVersion);
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
                    const fieldRecord = response.fields.find((r) => r.name === f);
                    return FIELD_TYPES[fieldRecord === null || fieldRecord === void 0 ? void 0 : fieldRecord.type] || "string";
                });
                for (const info of renderer.uniqueValueInfos) {
                    const values = normalizeValuesForFieldTypes(info.value, renderer.fieldDelimiter, fieldTypes);
                    layers.push(...symbolToLayers(info.symbol, sourceId, imageList, rootUrl, sublayer, legendItemIndex++).map((lyr) => {
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
                    layers.push(...symbolToLayers(renderer.defaultSymbol, sourceId, imageList, rootUrl, sublayer, 0).map((lyr) => {
                        lyr.filter = ["none", ...filters];
                        return lyr;
                    }));
                }
                break;
            }
            case "classBreaks":
                // TODO: look for test dataset for backgroundFillSymbol
                if (renderer.backgroundFillSymbol) {
                    layers.push(...symbolToLayers(renderer.backgroundFillSymbol, sourceId, imageList, rootUrl, sublayer, 0));
                }
                const field = renderer.field;
                const filters = [];
                legendItemIndex = renderer.classBreakInfos.length - 1;
                let minValue = 0;
                const minMaxValues = renderer.classBreakInfos.map((b) => {
                    const values = [b.classMinValue || minValue, b.classMaxValue];
                    minValue = values[1];
                    return values;
                });
                for (const info of [...renderer.classBreakInfos].reverse()) {
                    layers.push(...symbolToLayers(info.symbol, sourceId, imageList, rootUrl, sublayer, legendItemIndex--).map((lyr) => {
                        const [min, max] = minMaxValues[renderer.classBreakInfos.indexOf(info)];
                        if (renderer.classBreakInfos.indexOf(info) === 0) {
                            lyr.filter = ["all", ["<=", field, max]];
                        }
                        else {
                            lyr.filter = ["all", [">", field, min], ["<=", field, max]];
                        }
                        filters.push(lyr.filter);
                        return lyr;
                    }));
                }
                if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
                    const defaultLayers = await symbolToLayers(renderer.defaultSymbol, sourceId, imageList, rootUrl, sublayer, 0);
                    for (const index in defaultLayers) {
                        defaultLayers[index].filter = ["none", filters];
                    }
                    layers.push(...defaultLayers);
                }
                break;
            default:
                // simple
                layers = symbolToLayers(renderer.symbol, sourceId, imageList, rootUrl, sublayer, 0);
                break;
        }
        if (response.drawingInfo.labelingInfo) {
            for (const info of response.drawingInfo.labelingInfo) {
                const layer = esriTS(info, response.geometryType, response.fields.map((f) => f.name));
                layer.source = sourceId;
                layer.id = generateId();
                layers.push(layer);
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
    exports.ArcGISVectorSource = ArcGISVectorSource;
    exports.styleForFeatureLayer = styleForFeatureLayer;

    return exports;

}({}));
