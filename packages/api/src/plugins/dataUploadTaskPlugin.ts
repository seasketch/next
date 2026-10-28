import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { storageClientV2 } from "../storage/client";

export const UPLOAD_TASK_PRESIGNED_URL_TTL = 60 * 120; // 120 minutes

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
          return storageClientV2().getSignedUrlPromise("putObject", {
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
