import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { AwsClient as R2Client } from "aws4fetch";
import { makeWrapResolversPlugin } from "postgraphile";
import { RateLimiterRedis } from "rate-limiter-flexible";
import redis, { RedisClient } from "redis";

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_FILE_UPLOADS_BUCKET,
} = process.env;

const r2 = new R2Client({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
});

/** 4 hours in seconds */
const PRESIGNED_UPLOAD_TTL = 60 * 60 * 4;

/**
 * This plugin allows users to upload files to cloud storage. It creates a
 * record in the file_uploads table, which contains metadata about the file
 * (e.g. filename, content type, size, etc.). It also returns a presigned URL
 * that can be used to upload the file to cloud storage.
 *
 * This mechanism of file uploads is intended to support multiple use cases:
 *   1) Forum post attachments
 *   2) Survey response attachments
 *
 * Further use cases can be added by extending the FileUploadTypeInput GraphQL
 * enum and the related file_upload_type enum in the db, as well as updating
 * access control rules.
 */
const FileUploadPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      enum FileUploadTypeInput {
        """
        File was uploaded as part of a forum post. Access control should follow
        from forum post read permissions.
        """
        FORUM_ATTACHMENT

        """
        File was uploaded as part of a survey response. Only project
        administrators and the user who uploaded the file should be able to
        access it.
        """
        SURVEY_RESPONSE
      }

      extend type FileUpload {
        """
        Use to upload to cloud storage (PUT).
        """
        presignedUploadUrl: String
          @requires(
            columns: [
              "id"
              "filename"
              "content_type"
              "file_size_bytes"
              "user_id"
              "created_at"
            ]
          )
      }
    `,
    resolvers: {
      FileUpload: {
        presignedUploadUrl: async (fileUpload, args, context, info) => {
          // Don't allow users to upload files for other users or after TTL
          if (
            fileUpload.userId !== context.user?.id ||
            new Date().getTime() - new Date(fileUpload.createdAt).getTime() >
              PRESIGNED_UPLOAD_TTL * 1000
          ) {
            throw new Error("Unauthorized");
          }
          return r2.sign(
            `${R2_ENDPOINT}/${R2_FILE_UPLOADS_BUCKET}/${fileUpload.id}/${fileUpload.filename}`,
            {
              method: "PUT",
              aws: { signQuery: true, allHeaders: true },
              headers: {
                "x-amz-expires": PRESIGNED_UPLOAD_TTL.toString(),
                "content-type": fileUpload.contentType,
                "content-length": fileUpload.fileSizeBytes,
              },
            }
          );
        },
      },
    },
  };
});

let limiter: RateLimiterRedis;
if (process.env.NODE_ENV !== "test") {
  const redisClient = redis.createClient({
    connect_timeout: 5000,
    host: process.env.REDIS_HOST || "127.0.0.1",
  });

  // It is recommended to process Redis errors and setup some reconnection strategy
  redisClient.on("error", (err) => {});

  limiter = new RateLimiterRedis({
    // Basic options
    storeClient: redisClient,
    // 10 uploads can be created every 60 seconds per user
    points: 10, // Number of points
    duration: 60, // Per second(s).
    keyPrefix: "fileUploads", // must be unique for limiters with different purpose
  });
}

const FileUploadRateLimiterPlugin = makeWrapResolversPlugin({
  Mutation: {
    createFileUpload: (resolve, source, args, context, resolveInfo) => {
      if (args.input?.file_size_bytes > 100000000) {
        throw new Error("File size must be less than 100MB");
      }
      if (limiter) {
        if (context?.user?.sub) {
          return limiter
            .consume(context.user.sub, 1)
            .then((value) => {
              return resolve(source, args, context, resolveInfo);
            })
            .catch((e) => {
              throw new Error("Rate limited");
            });
        } else {
          throw new Error("You must be logged in to create a file upload");
        }
      } else {
        return resolve(source, args, context, resolveInfo);
      }
    },
  },
});

export { FileUploadPlugin, FileUploadRateLimiterPlugin };
