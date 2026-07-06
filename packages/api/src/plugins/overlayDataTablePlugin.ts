import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { S3 } from "aws-sdk";

export const DATA_TABLE_UPLOAD_PRESIGNED_URL_TTL = 60 * 120;

function remoteToPublicUrl(remote: string | null | undefined): string | null {
  if (!remote) return null;
  const base =
    process.env.UPLOADS_BASE_URL || process.env.TILES_BASE_URL || "";
  if (!base) return null;
  const key = remote.replace(/^r2:\/\//, "").split("/").slice(1).join("/");
  return `${base.replace(/\/$/, "")}/${key}`;
}

const OverlayDataTablePlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type OverlayDataTable {
      parquetUrl: String @requires(columns: ["parquetRemote"])
      columnStatsUrl: String @requires(columns: ["columnStatsRemote"])
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
