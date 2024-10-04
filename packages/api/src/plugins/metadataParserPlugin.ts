import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { metadataToProseMirror } from "@seasketch/metadata-parser";
import { v4 as uuid } from "uuid";
import S3 from "aws-sdk/clients/s3";

const r2 = new S3({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  signatureVersion: "v4",
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
});

const REQUIRED_ENV_VARS = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];

const MetadataParserPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  for (const envvar of REQUIRED_ENV_VARS) {
    if (!process.env[envvar]) {
      throw new Error(`Missing env var ${envvar}`);
    }
  }
  return {
    typeDefs: gql`
      extend type Mutation {
        updateTocMetadataFromXML(
          id: Int!
          xmlMetadata: String!
          filename: String
        ): TableOfContentsItem!
      }
    `,
    resolvers: {
      Mutation: {
        updateTocMetadataFromXML: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;

          const data = await metadataToProseMirror(args.xmlMetadata);
          if (data?.doc) {
            // get project id related to table of contents item from db
            const { rows: projectRows } = await pgClient.query(
              `select project_id from public.table_of_contents_items where id = $1`,
              [args.id]
            );
            if (!projectRows?.[0]?.project_id) {
              throw new Error("Table of contents item not found");
            }
            const projectId = projectRows[0].project_id;

            // get the project slug
            const { rows: slugRows } = await pgClient.query(
              `select slug from public.projects where id = $1`,
              [projectId]
            );
            if (!slugRows?.[0]?.slug) {
              throw new Error("Project not found");
            }
            const slug = slugRows[0].slug;

            const objectPath = `projects/${slug}/metadata-updates/${uuid()}.xml`;
            const remote = `r2://${process.env.R2_TILES_BUCKET}/${objectPath}`;
            const url = `https://uploads.seasketch.org/${objectPath}`;
            // get byte length of xmlMetadata
            const byteLength = Buffer.byteLength(args.xmlMetadata, "utf8");
            // create a record in the db
            await pgClient.query(
              `select create_metadata_xml_output((
                select data_source_id from data_layers where id = (select data_layer_id from public.table_of_contents_items where id = $1)
              ), $2, $3, $4, $5, $6)`,
              [
                args.id,
                url,
                remote,
                byteLength,
                args.filename || "metadata.xml",
                `"${data.type}"`,
              ]
            );
            // Save to r2
            const uploadParams = {
              Bucket: process.env.R2_TILES_BUCKET,
              Key: objectPath,
              Body: args.xmlMetadata, // The XML content
              ContentType: "application/xml", // MIME type for XML files
            };

            await r2.upload(uploadParams).promise();
            const { rows } = await pgClient.query(
              `update public.table_of_contents_items set metadata = $1 where id = $2 returning data_layer_id`,
              [data.doc, args.id]
            );
            if (rows?.[0].data_layer_id && data.attribution) {
              await pgClient.query(
                `update public.data_sources set attribution = $1 where id = any(select data_source_id from data_layers where id = $2)`,
                [data.attribution, rows[0].data_layer_id]
              );
            }
            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`public.table_of_contents_items`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(args.id)}`
                  );
                }
              );
            return row;
          } else {
            throw new Error("Invalid metadata");
          }
        },
      },
    },
  };
});

export default MetadataParserPlugin;
