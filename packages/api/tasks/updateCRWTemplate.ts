/**
 Updates NOAA Coral Reef Watch (CRW) Data Library template with daily updated
 data.

 data_library_template_id of interest are:

    - CRW_ROOT
    - CRW_STATIONS
    - CRW_OVERLAYS
    - CRW_BAA
    - CRW_DHW
    - CRW_HOTSPOTS
    - CRW_SST
    - CRW_SSTA
    - CRW_SSTT
 */
import { parseKmlToGeoJson } from "../src/DataLibrary/crwVirtualStations";
import { JobHelpers } from "graphile-worker";
import { S3 } from "aws-sdk";
import {
  getTemplateDetails,
  updateSourceWithGeoJSON,
  updateSourceWithUrl,
} from "../src/DataLibrary/dataLibraryUtils";
import axios from "axios";
import { parse } from "node-html-parser";

const region = process.env.S3_REGION;
const bucket = process.env.SPATIAL_UPLOADS_BUCKET;
const s3 = new S3({ region });

const KML_URL =
  "https://coralreefwatch.noaa.gov/product/ge/CRW_5km_Product_Suite_v2.kml";

type OverlayUrls = {
  [templateId: string]: string;
};

const overlays: OverlayUrls = {
  CRW_BAA:
    "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/baa5-max-7d/",
  CRW_DHW:
    "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/dhw/",
  CRW_HOTSPOTS:
    "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/hs/",
  CRW_SST:
    "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/sst/",
  CRW_SSTA:
    "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/ssta/",
  CRW_SSTT:
    "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/sst-trend-7d/",
};

module.exports = async (payload: any, helpers: JobHelpers) => {
  helpers.logger.info(`Updating NOAA Coral Reef Watch Data Library template`);
  await helpers.withPgClient(async (client) => {
    const promises: Promise<any>[] = [];
    for (const [templateId, baseUrl] of Object.entries(overlays)) {
      const { itemId, dataSourceId, lastUpdated } = await getTemplateDetails(
        templateId,
        client
      );
      const now = new Date();
      const diff = Math.abs(now.getTime() - lastUpdated.getTime());
      // if data is older than 3 hours, update
      if (payload.force || diff > 3 * 60 * 60 * 1000) {
        const { url, date } = await getLatestOverlayNetCDF(baseUrl);
        if (date > lastUpdated || payload.force) {
          helpers.logger.info(
            `update ${templateId} with ${url}, dataSourceId: ${dataSourceId}`
          );
          promises.push(
            updateSourceWithUrl(url, itemId, templateId, client, helpers)
          );
        } else {
          helpers.logger.info(
            `${templateId} data is up to date, skipping update`
          );
        }
      } else {
        helpers.logger.info(
          `${templateId} data is up to date, skipping update`
        );
      }
    }
    const { itemId, dataSourceId, lastUpdated } = await getTemplateDetails(
      "CRW_STATIONS",
      client
    );
    const now = new Date();
    const anyUpdatedOverlays = promises.length > 0;
    if (payload.force || anyUpdatedOverlays) {
      const kmlData = await fetch(KML_URL).then((res) => res.text());
      const geojson = await parseKmlToGeoJson(kmlData);
      await updateSourceWithGeoJSON(
        geojson,
        itemId,
        "CRW_STATIONS",
        client,
        helpers
      );
    } else {
      helpers.logger.info(`CRW_STATIONS data is up to date, skipping update`);
    }
  });
};

async function getLatestOverlayNetCDF(baseUrl: string) {
  const currentYear = new Date().getFullYear();
  const yearUrl = `${baseUrl}${currentYear}/`;
  const yearResponse = await axios.get(yearUrl);
  const yearRoot = parse(yearResponse.data);
  const fileLinks = yearRoot
    .querySelectorAll("a")
    .map((el) => el.getAttribute("href"))
    .filter((href) => href && href.endsWith(".nc"));
  if (fileLinks.length > 0) {
    // Sort files in descending order to get the latest file first
    fileLinks.sort().reverse();
    const latestFile = fileLinks[0]!;
    // get the year from the filename. (e.g. ct5km_sst-trend-7d_v3.1_20240112.nc
    // becomes 2024-01-12) and create a js date object
    const year = latestFile.match(/\d{8}/)![0];
    const date = new Date(
      `${year.slice(0, 4)}-${year.slice(4, 6)}-${year.slice(6, 8)}`
    );
    return {
      url: yearUrl + latestFile,
      date,
    };
  } else {
    throw new Error("No NetCDF files found in " + yearUrl);
  }
}
