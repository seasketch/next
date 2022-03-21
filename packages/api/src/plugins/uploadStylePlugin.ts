import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import * as S3 from "aws-sdk/clients/s3";
import { FileUpload } from "graphql-upload";
import stream from "stream";
import { v4 as uuid } from "uuid";
import { createHash } from "crypto";
import { DBClient } from "../dbClient";

const s3 = new S3.default({
  region: process.env.S3_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const UploadStylePlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Mutation {
        """
        Upload mapbox-gl-style documents for use as basemaps
        """
        uploadStyle(
          """
          Style json file
          """
          style: JSON!
          thumb: Upload!
          """
          Existing basemap ID, if updating
          """
          id: Int
          projectId: Int!
          """
          Name for the basemap
          """
          name: String!
          surveysOnly: Boolean
        ): Basemap!
      }
    `,
    resolvers: {
      Query: {},
      Mutation: {
        uploadStyle: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          const { filename, createReadStream, mimetype, encoding } =
            await args.thumb;
          pgClient as DBClient;
          // create a new one
          const thumbnail = await saveThumbnail(
            createReadStream(),
            mimetype,
            `styles/${uuid()}`
          );
          const url = await saveStyle(args.style, `styles/${uuid()}`);
          // create
          let query = `insert into basemaps (name, url, project_id, type, surveys_only, thumbnail) values ($1, $2, $3, 'MAPBOX', $4, $5) returning id`;
          let props: any[] = [
            args.name,
            url,
            args.projectId,
            Boolean(args.surveys_only),
            thumbnail,
          ];
          if (args.id) {
            // update
            query = `update basemaps set url = $1, name = $3 where id = $2 returning id`;
            props = [url, parseInt(args.id), args.name];
          }
          const r = await pgClient.query(query, props);
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.basemaps`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(r.rows[0].id)}`
              );
            }
          );
          return row;
        },
      },
    },
  };
});

async function saveStyle(style: any, filename: string) {
  let ext = "json";
  const url = `https://${process.env.PUBLIC_UPLOADS_DOMAIN}/${filename}.${ext}`;
  const response = await s3
    .upload({
      Bucket: process.env.PUBLIC_S3_BUCKET!,
      Key: filename + "." + ext,
      Body: JSON.stringify(style),
      ContentType: "application/json",
      CacheControl: "public, max-age=31536000",
    })
    .promise();
  return url;
}

async function saveThumbnail(stream: any, mimetype: string, filename: string) {
  let ext = "jpg";
  if (mimetype === "image/png") {
    ext = "png";
  } else if (mimetype === "image/gif") {
    ext = "gif";
  }
  const url = `https://${process.env.PUBLIC_UPLOADS_DOMAIN}/${filename}.${ext}`;
  const { writeStream, promise } = uploadStream(filename + "." + ext, mimetype);
  stream.pipe(writeStream).on("error", (error: Error) => {
    throw error;
  });
  await promise;
  return url;
}

const uploadStream = (key: string, ContentType: string) => {
  const pass = new stream.PassThrough();
  return {
    writeStream: pass,
    promise: s3
      .upload({
        Bucket: process.env.PUBLIC_S3_BUCKET!,
        Key: key,
        Body: pass,
        ContentType,
        CacheControl: "public, max-age=31536000",
      })
      .promise(),
  };
};

export default UploadStylePlugin;
