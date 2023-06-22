import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { makeWrapResolversPlugin } from "postgraphile";
import { RateLimiterRedis } from "rate-limiter-flexible";
import redis from "redis";
import {
  getSignedUrl,
  S3RequestPresigner,
} from "@aws-sdk/s3-request-presigner";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getDirectCreatorUploadUrl } from "../cloudflareImages";
import bytes from "bytes";

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_FILE_UPLOADS_BUCKET,
} = process.env;

const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
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
              "cloudflare_images_id"
            ]
          )

        """
        Includes a temporary token to enable download. Use
        rel="download nofollow" so that it is not indexed by search engines.
        """
        downloadUrl: String!
          @requires(
            columns: [
              "id"
              "filename"
              "type"
              "content_type"
              "cloudflare_images_id"
            ]
          )
      }

      type UploaderResponse {
        cloudflareImagesUploadUrl: String
        fileUpload: FileUpload!
      }

      enum FileUploadUsageInput {
        forum_attachment
        survey_response
      }

      extend type Mutation {
        createFileUpload(
          contentType: String!
          filename: String!
          fileSizeBytes: Int!
          usage: FileUploadUsageInput!
          projectId: Int!
        ): UploaderResponse!
      }
    `,
    resolvers: {
      Mutation: {
        createFileUpload: async (_query, args, context, resolveInfo) => {
          const { filename, contentType, fileSizeBytes, usage, projectId } =
            args;
          const { user } = context;
          if (!user) {
            throw new Error("Unauthorized");
          }
          // check if contentType is in cloudflare images support list
          const cloudflareImagesSupported = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
          ];
          const isCloudflareImagesSupported =
            cloudflareImagesSupported.includes(contentType) &&
            fileSizeBytes < bytes("10mb");
          if (isCloudflareImagesSupported) {
            const img = await getDirectCreatorUploadUrl();

            console.log(img);
            const { rows } = await context.adminPool.query(
              `insert into file_uploads (
                filename,
                content_type,
                file_size_bytes,
                user_id,
                cloudflare_images_id,
                project_id,
                usage
              ) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
              [
                filename,
                contentType,
                fileSizeBytes,
                user.id,
                img.id,
                projectId,
                usage,
              ]
            );
            return {
              cloudflareImagesUploadUrl: img.uploadURL,
              fileUpload: {
                ...rows[0],
                contentType: rows[0].content_type,
                fileSizeBytes: rows[0].file_size_bytes,
                cloudflareImagesId: rows[0].cloudflare_images_id,
                projectId: rows[0].project_id,
                userId: rows[0].user_id,
                createdAt: rows[0].created_at,
                postId: rows[0].post_id,
                isSpatial: rows[0].is_spatial,
                tilejsonEndpoint: rows[0].tilejson_endpoint,
              },
            };
          } else {
            console.log(user);
            const { rows } = await context.adminPool.query(
              `insert into file_uploads (
                filename,
                content_type,
                file_size_bytes,
                user_id,
                project_id,
                usage
              ) values ($1, $2, $3, $4, $5, $6) returning *`,
              [filename, contentType, fileSizeBytes, user.id, projectId, usage]
            );
            return {
              fileUpload: {
                ...rows[0],
                contentType: rows[0].content_type,
                fileSizeBytes: rows[0].file_size_bytes,
                cloudflareImagesId: rows[0].cloudflare_images_id,
                projectId: rows[0].project_id,
                userId: rows[0].user_id,
                createdAt: rows[0].created_at,
                postId: rows[0].post_id,
                isSpatial: rows[0].is_spatial,
                tilejsonEndpoint: rows[0].tilejson_endpoint,
              },
            };
          }
        },
      },
      FileUpload: {
        presignedUploadUrl: async (fileUpload, args, context, info) => {
          if (fileUpload.cloudflareImagesId) {
            return null;
          }
          // Don't allow users to upload files for other users or after TTL
          if (
            fileUpload.userId !== context.user?.id ||
            new Date().getTime() - new Date(fileUpload.createdAt).getTime() >
              PRESIGNED_UPLOAD_TTL * 1000
          ) {
            throw new Error("Unauthorized");
          }

          return await getSignedUrl(
            r2,
            new PutObjectCommand({
              Bucket: R2_FILE_UPLOADS_BUCKET,
              Key: `${fileUpload.id}/${fileUpload.filename}`,
              ContentType: fileUpload.contentType,
              ContentLength: fileUpload.fileSizeBytes,
              ContentDisposition: `attachment; filename="${fileUpload.filename}"`,
              CacheControl: "public, immutable, max-age=31536000",
            }),
            {
              expiresIn: PRESIGNED_UPLOAD_TTL,
            }
          );
        },
        downloadUrl: async (fileUpload, args, context, info) => {
          const { filename, contentType, id, cloudflareImagesId } = fileUpload;
          if (cloudflareImagesId) {
            return `https://imagedelivery.net/${process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH}/${cloudflareImagesId}/`;
          } else {
            return await getSignedUrl(
              r2,
              new GetObjectCommand({
                Bucket: R2_FILE_UPLOADS_BUCKET,
                Key: `${id}/${filename}`,
              }),
              {
                expiresIn: 60 * 60 * 48,
              }
            );
          }
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

/**
 * This plugin limits the number of file uploads that a user can create in a
 * given time period, as well as the maximum file size.
 * It is intended to prevent abuse of the file upload mechanism.
 */
const FileUploadRateLimiterPlugin = makeWrapResolversPlugin({
  Mutation: {
    createFileUpload: (resolve, source, args, context, resolveInfo) => {
      if (args.input?.file_size_bytes > 100_000_000) {
        throw new Error("File size must be less than 100MB");
      }
      if (limiter) {
        if (context?.user?.sub) {
          return limiter.consume(context.user.sub, 1).then((value) => {
            return resolve(source, args, context, resolveInfo);
          });
          // .catch((e) => {
          //   console.log(e);
          //   throw new Error("Rate limited");
          // });
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
