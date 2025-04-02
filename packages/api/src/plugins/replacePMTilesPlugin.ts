import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import * as S3 from "aws-sdk/clients/s3";
import { FileUpload } from "graphql-upload";
import stream from "stream";
import { v4 as uuid } from "uuid";
import { createHash } from "crypto";
import { DBClient } from "../dbClient";
import { PMTiles, TileType } from "pmtiles";

const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } = process.env;

const r2 = new S3.default({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const region = process.env.S3_REGION;
const bucket = process.env.SPATIAL_UPLOADS_BUCKET;
const s3 = new S3.default({ region });

const ReplacePMTilesPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      type PresignedUrl {
        url: String!
        key: String!
      }

      extend type Mutation {
        """
        Replace the tileset for an existing data source
        """
        replacePMTiles(pmtilesKey: String!, dataSourceId: Int!): DataLayer!

        getPresignedPMTilesUploadUrl(
          filename: String!
          bytes: Int!
        ): PresignedUrl!
      }
    `,
    resolvers: {
      Query: {},
      Mutation: {
        getPresignedPMTilesUploadUrl: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { filename, bytes } = args;
          const key = `uploads/${uuid()}/${filename}`;
          const url = await s3.getSignedUrlPromise("putObject", {
            Bucket: bucket,
            Key: key,
            Expires: 60 * 60 * 4,
            ContentType: "application/vnd.pmtiles",
            // ContentLength: bytes,
          });
          return { url, key };
        },
        replacePMTiles: async (_query, args, context, resolveInfo) => {
          const { pgClient, adminPool } = context;
          // get id, type, url, project_id from data_sources, inner join to get
          // project slug
          const r = await pgClient.query(
            `
              select 
                data_sources.id, 
                data_sources.type, 
                data_sources.url, 
                data_sources.project_id, 
                projects.slug 
              from data_sources 
              inner join projects 
              on projects.id = data_sources.project_id 
              where data_sources.id = $1
            `,
            [args.dataSourceId]
          );
          const [row] = r.rows;
          if (!row) {
            throw new Error("Data source not found");
          }
          if (row.type !== "seasketch-mvt" && row.type !== "seasketch-raster") {
            throw new Error("Data source is not a tileset");
          }
          const { pmtilesKey } = args;
          pgClient as DBClient;
          // verify that the uploaded pmtiles file is valid
          // that means,
          //   * it should have the correct magic bytes
          //   * it should contain only a single layer
          // and we'll need to get the layer name so that the
          // data_layer.layer_name property can be corrected if need be

          const pmtiles = new PMTiles({
            getKey() {
              return "";
            },
            async getBytes(offset: number, length: number) {
              try {
                const resp = await s3
                  .getObject({
                    Bucket: bucket,
                    Key: pmtilesKey,
                    Range: `bytes=${offset}-${offset + length - 1}`,
                  })
                  .promise();
                if (!resp.Body) {
                  throw new Error("Failed to get bytes from S3");
                }
                return {
                  data: (resp.Body as Buffer).buffer,
                  cacheControl: "public, immutable, max-age=31536000",
                };
              } catch (error) {
                console.error(error);
                throw new Error("Failed to get bytes from S3");
              }
            },
          });

          const header = await pmtiles.getHeader();
          if (
            row.type === "seasketch-mvt" &&
            header.tileType !== TileType.Mvt
          ) {
            throw new Error(
              "Tile archive contains raster tiles, but this is a vector dataset."
            );
          } else if (
            row.type === "seasketch-raster" &&
            header.tileType === TileType.Mvt
          ) {
            throw new Error(
              "Tile archive contains vector tiles, but this is a raster dataset."
            );
          }

          const metadata = (await pmtiles.getMetadata()) as any;
          let layerName = "";
          if (row.type === "seasketch-mvt") {
            if (metadata.vector_layers.length > 1) {
              throw new Error("PMTiles file contains more than one layer");
            } else if (metadata.vector_layers.length === 0) {
              throw new Error("PMTiles file contains no layers");
            }
            layerName = metadata.vector_layers[0].id;
          }

          // Get size of object in s3
          const bytes = (
            await s3
              .headObject({
                Bucket: bucket,
                Key: pmtilesKey,
              })
              .promise()
          ).ContentLength!;

          // assuming you get this far, copy the file from s3 to r2
          // create a readable stream from the s3 object
          const s3Stream = s3
            .getObject({
              Bucket: bucket,
              Key: pmtilesKey,
            })
            .createReadStream();
          const r2Key = `${row.slug}/public/${uuid()}.pmtiles`;
          const r2Url = `https://tiles.seasketch.org/${r2Key.replace(
            ".pmtiles",
            ""
          )}`;
          const pass = new stream.PassThrough();
          const promise = r2
            .upload({
              Bucket: process.env.R2_TILES_BUCKET!,
              Key: r2Key,
              Body: pass,
              ContentType: "application/vnd.pmtiles",
              CacheControl: "public, max-age=31536000",
            })
            .promise();
          console.log("Uploading to R2", r2Key);
          s3Stream.pipe(pass).on("error", (error: Error) => {
            throw error;
          });
          await promise;
          console.log("done uploading");

          // update the data_source.url
          await pgClient.query(
            `
              update data_sources
              set url = $1
              where id = $2
            `,
            [r2Url, args.dataSourceId]
          );

          if (row.type === "seasketch-mvt") {
            // update the data_layer.source_layer
            await pgClient.query(
              `
              update data_layers
              set source_layer = $1
              where data_source_id = $2
            `,
              [layerName, args.dataSourceId]
            );
          }
          // delete old pmtiles data_upload_output
          await adminPool.query(
            `
              delete from data_upload_outputs
              where data_source_id = $1 and type = 'PMTiles'
            `,
            [args.dataSourceId]
          );
          // create new pmtiles data_upload_output
          await adminPool.query(
            `
              insert into data_upload_outputs (
                data_source_id,
                project_id,
                type,
                url,
                remote,
                size,
                filename,
                is_custom_upload
              ) values ($1, $2, 'PMTiles', $3, $4, $5, $6, true)
            `,
            [
              args.dataSourceId,
              row.project_id,
              r2Url,
              `r2://${process.env.R2_TILES_BUCKET}/${r2Key}`,
              bytes,
              r2Url.split("/").pop(),
            ]
          );

          // return the data_layer
          const [dataLayer] =
            await resolveInfo.graphile.selectGraphQLResultFromTable(
              sql.fragment`public.data_layers`,
              (tableAlias, queryBuilder) => {
                queryBuilder.where(
                  sql.fragment`${tableAlias}.data_source_id = ${sql.value(
                    args.dataSourceId
                  )}`
                );
              }
            );
          return dataLayer;
        },
      },
    },
  };
});

export default ReplacePMTilesPlugin;
