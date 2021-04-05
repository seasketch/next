import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { S3 } from "aws-sdk";

const DataSourcePlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      extend type DataSource {
        """
        Use to upload source data to s3. Must be an admin.
        """
        presignedUploadUrl: String
          @requires(columns: ["bucket_id", "object_key", "enhanced_security"])
      }
    `,
    resolvers: {
      DataSource: {
        presignedUploadUrl: async (source, args, context, info) => {
          const {
            rows,
          } = await context.pgClient.query(
            `select region, bucket from data_sources_buckets where url = $1`,
            [source.bucketId]
          );
          const region = rows[0].region;
          const bucket = rows[0].bucket;
          const s3 = new S3({ region });
          return s3.getSignedUrlPromise("putObject", {
            Bucket: bucket,
            Key: source.objectKey,
            Expires: 60 * 30, // 30 minutes
            ContentType: "application/json",
            Tagging: source.enhancedSecurity ? `enhancedSecurity=YES` : "",
            CacheControl: "max-age=31557600",
          });
        },
      },
    },
  };
});

export default DataSourcePlugin;
