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

const ConsentDocumentPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Mutation {
        """
        Use to upload pdf documents for use with the Consent FormElement
        """
        uploadConsentDocument(
          document: Upload!
          version: Int!
          formElementId: Int!
        ): FormElement!
      }
    `,
    resolvers: {
      Query: {},
      Mutation: {
        uploadConsentDocument: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          const { filename, createReadStream, mimetype, encoding } =
            await args.document;
          pgClient as DBClient;
          // create a new one
          const url = await savePdf(
            createReadStream(),
            mimetype,
            `consentDocs/${uuid()}`
          );
          const r = await pgClient.query(
            `select create_consent_document($1, $2, $3)`,
            [parseInt(args.formElementId), parseInt(args.version), url]
          );
          console.log(r.results);
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.form_elements`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  args.formElementId
                )}`
              );
            }
          );
          return row;
        },
      },
    },
  };
});

async function savePdf(stream: any, mimetype: string, filename: string) {
  let ext = "pdf";
  if (mimetype !== "application/pdf") {
    throw new Error("Document must be a pdf");
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

export default ConsentDocumentPlugin;
