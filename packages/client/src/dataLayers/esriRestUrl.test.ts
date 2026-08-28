import { describe, expect, it } from "@jest/globals";
import { getEsriRestUrl, isArcGisWebServiceType, esriRestUrlFromMetadataItem } from "./esriRestUrl";

describe("isArcGisWebServiceType", () => {
  it("accepts ArcGIS vector, dynamic map, and tiled map services", () => {
    expect(isArcGisWebServiceType("ARCGIS_VECTOR")).toBe(true);
    expect(isArcGisWebServiceType("ARCGIS_DYNAMIC_MAPSERVER")).toBe(true);
    expect(isArcGisWebServiceType("ARCGIS_RASTER_TILES")).toBe(true);
    expect(
      isArcGisWebServiceType("ARCGIS_DYNAMIC_MAPSERVER_VECTOR_SUBLAYER")
    ).toBe(true);
    expect(
      isArcGisWebServiceType("ARCGIS_DYNAMIC_MAPSERVER_RASTER_SUBLAYER")
    ).toBe(true);
  });

  it("rejects uploads and missing values", () => {
    expect(isArcGisWebServiceType("SEASKETCH_VECTOR")).toBe(false);
    expect(isArcGisWebServiceType("SEASKETCH_MVT")).toBe(false);
    expect(isArcGisWebServiceType("SEASKETCH_RASTER")).toBe(false);
    expect(isArcGisWebServiceType("GEOJSON")).toBe(false);
    expect(isArcGisWebServiceType("VECTOR")).toBe(false);
    expect(isArcGisWebServiceType("RASTER")).toBe(false);
    expect(isArcGisWebServiceType(null)).toBe(false);
    expect(isArcGisWebServiceType(undefined)).toBe(false);
  });
});

describe("getEsriRestUrl", () => {
  it("returns null for uploads, generic tiles, and missing urls", () => {
    expect(
      getEsriRestUrl({
        type: "SEASKETCH_VECTOR",
        url: "https://uploads.seasketch.org/layer.json",
      })
    ).toBeNull();
    expect(
      getEsriRestUrl({
        type: "RASTER",
        url: "https://example.com/tiles/{z}/{x}/{y}.png",
      })
    ).toBeNull();
    expect(
      getEsriRestUrl({
        type: "ARCGIS_VECTOR",
        url: null,
      })
    ).toBeNull();
  });

  it("returns tiled MapServer urls as stored", () => {
    expect(
      getEsriRestUrl({
        type: "ARCGIS_RASTER_TILES",
        url: "https://tiles.arcgis.com/tiles/org/arcgis/rest/services/Boundary/MapServer",
      })
    ).toBe(
      "https://tiles.arcgis.com/tiles/org/arcgis/rest/services/Boundary/MapServer"
    );
  });

  it("returns FeatureServer layer urls as stored", () => {
    expect(
      getEsriRestUrl({
        type: "ARCGIS_VECTOR",
        url: "https://example.com/arcgis/rest/services/Boundary/FeatureServer/0",
      })
    ).toBe(
      "https://example.com/arcgis/rest/services/Boundary/FeatureServer/0"
    );
  });

  it("appends MapServer sublayer ids", () => {
    expect(
      getEsriRestUrl({
        type: "ARCGIS_DYNAMIC_MAPSERVER",
        url: "https://example.com/arcgis/rest/services/Boundary/MapServer",
        sublayer: "0",
      })
    ).toBe("https://example.com/arcgis/rest/services/Boundary/MapServer/0");
  });

  it("does not double-append a sublayer already present on the url", () => {
    expect(
      getEsriRestUrl({
        type: "ARCGIS_VECTOR",
        url: "https://example.com/arcgis/rest/services/Boundary/FeatureServer/0",
        sublayer: "0",
      })
    ).toBe(
      "https://example.com/arcgis/rest/services/Boundary/FeatureServer/0"
    );
  });

  it("strips trailing slashes", () => {
    expect(
      getEsriRestUrl({
        type: "ARCGIS_DYNAMIC_MAPSERVER",
        url: "https://example.com/arcgis/rest/services/Boundary/MapServer/",
        sublayer: "2",
      })
    ).toBe("https://example.com/arcgis/rest/services/Boundary/MapServer/2");
  });
});

describe("esriRestUrlFromMetadataItem", () => {
  it("reads nested GraphQL-shaped source data", () => {
    expect(
      esriRestUrlFromMetadataItem({
        dataLayer: {
          sublayer: "3",
          dataSource: {
            type: "ARCGIS_DYNAMIC_MAPSERVER",
            url: "https://example.com/arcgis/rest/services/Boundary/MapServer",
          },
        },
      })
    ).toBe("https://example.com/arcgis/rest/services/Boundary/MapServer/3");
  });

  it("returns null for null, undefined, and non-objects", () => {
    expect(esriRestUrlFromMetadataItem(null)).toBeNull();
    expect(esriRestUrlFromMetadataItem(undefined)).toBeNull();
    expect(esriRestUrlFromMetadataItem("nope")).toBeNull();
  });
});
