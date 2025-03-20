import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import * as S3 from "aws-sdk/clients/s3";
import { FileUpload } from "graphql-upload";
import stream from "stream";
import { v4 as uuid } from "uuid";
import { createHash } from "crypto";
import { DBClient } from "../dbClient";

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_FILE_UPLOADS_BUCKET,
} = process.env;

const r2 = new S3.default({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const ReplacePMTilesPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Mutation {
        """
        Replace the tileset for an existing data source
        """
        replacePMTiles(pmtiles: Upload!, dataSourceId: Int!): DataSource!
      }
    `,
    resolvers: {
      Query: {},
      Mutation: {
        replacePMTiles: async (_query, args, context, resolveInfo) => {
          console.log("got request", args);
          const { pgClient } = context;
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
          console.log(r);
          if (!row) {
            throw new Error("Data source not found");
          }
          if (row.type !== "seasketch-mvt" && row.type !== "seasketch-raster") {
            throw new Error("Data source is not a tileset");
          }
          const { filename, createReadStream, mimetype, encoding } =
            await args.pmtiles;
          pgClient as DBClient;
          // create a new one
          console.log("saving", filename, mimetype, encoding);
          const url = await savePMTiles(
            createReadStream(),
            "application/vnd.pmtiles",
            uuid(),
            row.slug
          );
          console.log("done", url);
          // const r = await pgClient.query(
          //   `select create_consent_document($1, $2, $3)`,
          //   [parseInt(args.formElementId), parseInt(args.version), url]
          // );
          // const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
          //   sql.fragment`public.form_elements`,
          //   (tableAlias, queryBuilder) => {
          //     queryBuilder.where(
          //       sql.fragment`${tableAlias}.id = ${sql.value(
          //         args.formElementId
          //       )}`
          //     );
          //   }
          // );
          // return row;
        },
      },
    },
  };
});

async function savePMTiles(
  stream: any,
  mimetype: string,
  filename: string,
  slug: string
) {
  let ext = "pmtiles";
  if (mimetype !== "application/vnd.pmtiles") {
    throw new Error("Upload must be a pmtiles file");
  }
  const key = `${slug}/public/${filename}.${ext}`;
  const url = `https://tiles.seasketch.org/${key}`;
  const { writeStream, promise } = uploadStream(key, mimetype);
  stream.pipe(writeStream).on("error", (error: Error) => {
    throw error;
  });
  await promise;
  return url;
}

const uploadStream = (key: string, ContentType: string) => {
  const pass = new stream.PassThrough();
  console.log({ bucket: process.env.R2_TILES_BUCKET, key });
  return {
    writeStream: pass,
    promise: r2
      .upload({
        Bucket: process.env.R2_TILES_BUCKET!,
        Key: key,
        Body: pass,
        ContentType,
        CacheControl: "public, max-age=31536000",
      })
      .promise(),
  };
};

export default ReplacePMTilesPlugin;
