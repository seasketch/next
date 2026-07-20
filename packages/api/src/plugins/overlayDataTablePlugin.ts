import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { S3 } from "aws-sdk";

export const DATA_TABLE_UPLOAD_PRESIGNED_URL_TTL = 60 * 120;

function remoteKey(remote: string): string {
  return remote.replace(/^r2:\/\//, "").split("/").slice(1).join("/");
}

const UPLOADS_PUBLIC_BASE_URL = "https://uploads.seasketch.org";

function remoteToPublicUrl(remote: string | null | undefined): string | null {
  if (!remote) return null;
  return `${UPLOADS_PUBLIC_BASE_URL}/${remoteKey(remote)}`;
}

function tablePathFromParquetRemote(
  remote: string | null | undefined
): string | null {
  if (!remote) return null;
  const key = remoteKey(remote);
  const suffix = "/data.parquet";
  if (!key.endsWith(suffix)) return null;
  return key.slice(0, -suffix.length);
}

function remoteToQueryUrl(remote: string | null | undefined): string | null {
  const tablePath = tablePathFromParquetRemote(remote);
  if (!tablePath) return null;
  // Served by pmtiles-server DataTablesBackend on the uploads host (same ACL
  // as the parent layer's published UUID).
  return `${UPLOADS_PUBLIC_BASE_URL}/${tablePath}/query`;
}

const OverlayDataTablePlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type OverlayDataTable {
      parquetUrl: String @requires(columns: ["parquet_remote"])
      columnStatsUrl: String @requires(columns: ["column_stats_remote"])
      queryUrl: String @requires(columns: ["parquet_remote"])
    }

    extend type OverlayDataTableUpload {
      presignedUploadUrl: String
        @requires(columns: ["id", "filename", "contentType"])
    }
  `,
  resolvers: {
    OverlayDataTable: {
      parquetUrl: (table) => remoteToPublicUrl(table.parquetRemote),
      columnStatsUrl: (table) => remoteToPublicUrl(table.columnStatsRemote),
      queryUrl: (table) => remoteToQueryUrl(table.parquetRemote),
    },
    OverlayDataTableUpload: {
      presignedUploadUrl: async (upload) => {
        const region = process.env.S3_REGION;
        const bucket = process.env.SPATIAL_UPLOADS_BUCKET;
        const s3 = new S3({ region });
        return s3.getSignedUrlPromise("putObject", {
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
