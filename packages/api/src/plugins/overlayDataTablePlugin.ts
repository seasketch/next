import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { isOrganismInfo } from "@seasketch/geostats-types";
import { storageClientV2 } from "../storage/client";
import { replaceUrlFileName } from "../storage/urls";

export const DATA_TABLE_UPLOAD_PRESIGNED_URL_TTL = 60 * 120;

function tableDirectory(parquetUrl: string | null | undefined): string | null {
  if (!parquetUrl) return null;
  let url: URL;
  try {
    url = new URL(parquetUrl);
  } catch {
    return null;
  }
  if (!url.pathname.endsWith("/data.parquet")) return null;
  return url.pathname.slice(0, -"/data.parquet".length);
}

function queryUrl(parquetUrl: string | null | undefined): string | null {
  const directory = tableDirectory(parquetUrl);
  if (!directory || !parquetUrl) return null;
  const url = new URL(parquetUrl);
  url.pathname = `${directory}/query`;
  url.search = "";
  return url.toString();
}

function orgQueryUrl(parquetUrl: string | null | undefined): string | null {
  const directory = tableDirectory(parquetUrl);
  if (!directory || !parquetUrl) return null;
  const url = new URL(parquetUrl);
  const tablePath = directory.replace(/^\//, "");
  url.pathname = "/orgQuery";
  url.search = "";
  url.searchParams.set("tables", tablePath);
  return url.toString();
}

function temporalPreviewUrl(parquetUrl: string | null | undefined): string | null {
  const directory = tableDirectory(parquetUrl);
  if (!directory || !parquetUrl) return null;
  const url = new URL(parquetUrl);
  url.pathname = `${directory}/temporal-preview`;
  url.search = "";
  return url.toString();
}

function siblingUrl(
  parquetUrl: string | null | undefined,
  filename: string
): string | null {
  if (!tableDirectory(parquetUrl) || !parquetUrl) return null;
  return replaceUrlFileName(parquetUrl, filename);
}

function tableHasOrganism(table: { organism?: unknown }): boolean {
  const value = table.organism;
  if (typeof value === "string") {
    try {
      return isOrganismInfo(JSON.parse(value));
    } catch {
      return false;
    }
  }
  return isOrganismInfo(value);
}

const OverlayDataTablePlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type OverlayDataTable {
      parquetUrl: String @requires(columns: ["parquet_url"])
      columnStatsUrl: String @requires(columns: ["parquet_url"])
      queryUrl: String @requires(columns: ["parquet_url"])
      orgQueryUrl: String @requires(columns: ["parquet_url", "organism"])
      temporalPreviewUrl: String @requires(columns: ["parquet_url"])
      organismCatalogUrl: String @requires(columns: ["parquet_url", "organism"])
      organismPreviewUrl: String @requires(columns: ["parquet_url", "organism"])
    }

    extend type OverlayDataTableUpload {
      presignedUploadUrl: String
        @requires(columns: ["id", "filename", "contentType"])
    }
  `,
  resolvers: {
    OverlayDataTable: {
      parquetUrl: (table) => table.parquetUrl || null,
      columnStatsUrl: (table) =>
        table.parquetUrl
          ? replaceUrlFileName(table.parquetUrl, "column-stats.json")
          : null,
      queryUrl: (table) => queryUrl(table.parquetUrl),
      orgQueryUrl: (table) =>
        tableHasOrganism(table) ? orgQueryUrl(table.parquetUrl) : null,
      temporalPreviewUrl: (table) => temporalPreviewUrl(table.parquetUrl),
      organismCatalogUrl: (table) =>
        tableHasOrganism(table)
          ? siblingUrl(table.parquetUrl, "organism-catalog.parquet")
          : null,
      organismPreviewUrl: (table) =>
        tableHasOrganism(table)
          ? siblingUrl(table.parquetUrl, "organism-preview.json")
          : null,
    },
    OverlayDataTableUpload: {
      presignedUploadUrl: async (upload) => {
        const bucket = process.env.SPATIAL_UPLOADS_BUCKET;
        return storageClientV2().getSignedUrlPromise("putObject", {
          Bucket: bucket,
          Key: `${upload.id}/${upload.filename}`,
          Expires: DATA_TABLE_UPLOAD_PRESIGNED_URL_TTL,
          ContentType: upload.contentType,
        });
      },
    },
  },
}));

export default OverlayDataTablePlugin;
