import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { S3 } from "aws-sdk";

export const UPLOAD_TASK_PRESIGNED_URL_TTL = 60 * 120; // 120 minutes

function stagingClient(): S3 {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2_ENDPOINT / R2 credentials must be set to presign uploads");
  }
  return new S3({
    region: "auto",
    endpoint: R2_ENDPOINT,
    signatureVersion: "v4",
    s3ForcePathStyle: true,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

const DataUploadTaskPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      extend type DataUploadTask {
        """
        Use to upload source data to s3. Must be an admin.
        """
        presignedUploadUrl: String
          @requires(columns: ["id", "filename", "content_type"])
      }
    `,
    resolvers: {
      DataUploadTask: {
        presignedUploadUrl: async (task, args, context, info) => {
          const bucket = process.env.SPATIAL_UPLOADS_BUCKET;
          return stagingClient().getSignedUrlPromise("putObject", {
            Bucket: bucket,
            Key: `${task.id}/${task.filename}`,
            Expires: UPLOAD_TASK_PRESIGNED_URL_TTL,
            ContentType: task.contentType,
          });
        },
      },
    },
  };
});

export default DataUploadTaskPlugin;
