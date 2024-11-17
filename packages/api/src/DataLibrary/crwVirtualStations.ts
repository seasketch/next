import * as fs from "fs";
// @ts-ignore
import * as xml2js from "xml2js";
import { JSDOM } from "jsdom";
import { Feature, Point, FeatureCollection } from "geojson";

interface PlacemarkProperties {
  name: string;
  date: string;
  SST: number | null;
  HotSpot: number | null;
  DHW: number | null;
  Anomaly: number | null;
  chartUrl: string;
  alertGaugesUrl: string;
  timeSeriesUrl: string;
  alertLevel: number;
}

/**
 * Parses KML data from Coral Reef Watch (CRW) and transforms it into GeoJSON
 * format.
 * @param kmlFilePath
 * @returns
 */
export async function parseKmlToGeoJson(
  kmlData: string
): Promise<FeatureCollection> {
  const parser = new xml2js.Parser();
  const kml = await parser.parseStringPromise(kmlData);
  const geoJsonFeatures: Feature<Point, PlacemarkProperties>[] = [];

  if (!kml.kml || !kml.kml.Document) {
    throw new Error("Invalid KML structure. Document tag not found.");
  }

  const folders = kml.kml.Document[0].Folder;
  if (!folders || !Array.isArray(folders)) {
    throw new Error("Invalid KML structure. Folders not found.");
  }

  function collectPlacemarks(folderContents: any) {
    const placemarks: any[] = [];
    if ("Placemark" in folderContents) {
      placemarks.push(...folderContents.Placemark);
    }
    if ("Folder" in folderContents) {
      for (const folder of folderContents.Folder) {
        const p = collectPlacemarks(folder);
        placemarks.push(...p);
      }
    }
    return placemarks.filter((p: any) => p);
  }
  const root = folders[1];

  const placemarks = root.Folder.map((f: any) => collectPlacemarks(f))
    .flat()
    .filter((p: any) => p);

  if (!placemarks || !Array.isArray(placemarks)) {
    throw new Error("Invalid KML structure. Placemarks not found.");
  }

  placemarks.forEach((placemark: any) => {
    const name = placemark.name?.[0] || "";
    const description = placemark.description?.[0] || "";
    const coordinatesStr = placemark.MultiGeometry[0].Point[0].coordinates[0];

    const coordinatesArray = coordinatesStr.split(",");
    const coordinates = [
      parseFloat(coordinatesArray[0]),
      parseFloat(coordinatesArray[1]),
    ];

    const dom = new JSDOM(description);
    const document = dom.window.document;

    const date =
      document
        .querySelector("font[size='3']")
        ?.textContent?.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] || "";
    const sst = getTableDataValue(document, "SST");
    const hotspot = getTableDataValue(document, "HotSpot");
    const dhw = getTableDataValue(document, "DHW");
    const anomaly = getTableDataValue(document, "Anomaly");
    const chartUrl =
      document.querySelector("img[src*='gauge']")?.getAttribute("src") || "";
    const alertGaugesUrl =
      Array.from(document.querySelectorAll("a"))
        .find((a) => a.textContent?.includes("Alert Gauges & Outlook"))
        ?.getAttribute("href") || "";
    const timeSeriesUrl =
      Array.from(document.querySelectorAll("a"))
        .find((a) => a.textContent?.includes("Time Series Graphs & Data"))
        ?.getAttribute("href") || "";

    // Extract marker image URL from the style
    const styleUrl = placemark.styleUrl?.[0] || "";
    let alertLevel = 1;
    if (styleUrl) {
      // convert #styleUrl to alert level
      alertLevel = parseInt(styleUrl.slice(-1));
    }

    const properties: PlacemarkProperties = {
      name,
      date: date.split("T")[0],
      SST: sst,
      HotSpot: hotspot,
      DHW: dhw,
      Anomaly: anomaly,
      chartUrl,
      alertGaugesUrl,
      timeSeriesUrl,
      alertLevel,
    };

    const feature: Feature<Point, PlacemarkProperties> = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates,
      },
      properties,
    };

    geoJsonFeatures.push(feature);
  });

  return {
    type: "FeatureCollection",
    features: geoJsonFeatures,
  };
}

function getTableDataValue(document: Document, label: string) {
  const tableCells = Array.from(document.querySelectorAll("td"));
  for (let i = 0; i < tableCells.length; i++) {
    if (
      tableCells[i].textContent?.trim().startsWith(label) &&
      tableCells[i + 1]
    ) {
      const strValue = tableCells[i + 1].textContent?.trim() || "";
      if (strValue) {
        return parseFloat(strValue);
      }
    }
  }
  return null;
}

// // Example usage:
// const KML_URL = "https://coralreefwatch.noaa.gov/product/ge/CRW_5km_Product_Suite_v2.kml";
// (async () => {
//   try {
//     const kmlData = await fetch(KML_URL).then((res) => res.text());
//     const geoJson = await parseKmlToGeoJson(kmlData);
//     fs.writeFileSync("output.geojson", JSON.stringify(geoJson, null, 2));
//     console.log("GeoJSON successfully created!");
//   } catch (error) {
//     console.error("Error:", error);
//   }
// })();
