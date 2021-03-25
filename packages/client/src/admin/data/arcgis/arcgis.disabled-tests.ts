import { normalizeArcGISServerUrl } from "./arcgis";

describe("normalizeArcGISServerUrl", () => {
  test("https://example.com expanded to https://example.com/arcgis/rest/services", async () => {
    const url = "https://example.com";
    const { baseUrl, servicesRoot, location } = normalizeArcGISServerUrl(url);
    expect(servicesRoot).toBe("https://example.com/arcgis/rest/services");
    expect(baseUrl).toBe("https://example.com");
    expect(location).toBe("/");
  });

  test("https://example.com/ expanded to https://example.com/arcgis/rest/services", async () => {
    const url = "https://example.com/";
    const { baseUrl, servicesRoot, location } = normalizeArcGISServerUrl(url);
    expect(servicesRoot).toBe("https://example.com/arcgis/rest/services");
    expect(baseUrl).toBe("https://example.com");
    expect(location).toBe("/");
  });

  test("https://example.com/arcgis/ -> https://example.com/arcgis/rest/services", async () => {
    const url = "https://example.com/arcgis/";
    const { baseUrl, servicesRoot, location } = normalizeArcGISServerUrl(url);
    expect(servicesRoot).toBe("https://example.com/arcgis/rest/services");
    expect(baseUrl).toBe("https://example.com");
    expect(location).toBe("/");
  });

  test("https://example.com/arcgis/rest -> https://example.com/arcgis/rest/services", async () => {
    const url = "https://example.com/arcgis/rest";
    const { baseUrl, servicesRoot, location } = normalizeArcGISServerUrl(url);
    expect(servicesRoot).toBe("https://example.com/arcgis/rest/services");
    expect(baseUrl).toBe("https://example.com");
    expect(location).toBe("/");
  });

  test("https://example.com/arcgis/rest/services/ -> https://example.com/arcgis/rest/services", async () => {
    const url = "https://example.com/arcgis/rest/services/";
    const { baseUrl, servicesRoot, location } = normalizeArcGISServerUrl(url);
    expect(servicesRoot).toBe("https://example.com/arcgis/rest/services");
    expect(baseUrl).toBe("https://example.com");
    expect(location).toBe("/");
  });

  test("https://example.com/arcgis/rest/services/myFolder/", async () => {
    const url = "https://example.com/arcgis/rest/services/myFolder/";
    const { baseUrl, servicesRoot, location } = normalizeArcGISServerUrl(url);
    expect(servicesRoot).toBe("https://example.com/arcgis/rest/services");
    expect(baseUrl).toBe("https://example.com");
    expect(location).toBe("/myFolder");
  });

  test("https://example.com/arcgis/rest/services/myFolder/myService", async () => {
    const url = "https://example.com/arcgis/rest/services/myFolder/myService";
    const { baseUrl, servicesRoot, location } = normalizeArcGISServerUrl(url);
    expect(servicesRoot).toBe("https://example.com/arcgis/rest/services");
    expect(baseUrl).toBe("https://example.com");
    expect(location).toBe("/myFolder/myService");
  });

  test("https://example.com/arcgis/rest/services/myFolder/arcgis/myService", async () => {
    const url =
      "https://example.com/arcgis/rest/services/myFolder/arcgis/myService";
    const { baseUrl, servicesRoot, location } = normalizeArcGISServerUrl(url);
    expect(servicesRoot).toBe("https://example.com/arcgis/rest/services");
    expect(baseUrl).toBe("https://example.com");
    expect(location).toBe("/myFolder/arcgis/myService");
  });
});
