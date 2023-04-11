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

const SpritesPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      # enum SpriteType {
      #   ICON
      #   FILL
      #   LINE
      # }

      extend type Mutation {
        """
        Use to create new sprites. If an existing sprite in the database for this
        project has a matching md5 hash no new Sprite will be created.
        """
        getOrCreateSprite(
          """
          Provide the lowest-dpi version of the sprite
          """
          smallestImage: Upload!
          width: Int!
          height: Int!
          pixelRatio: Int!
          projectId: Int!
          type: String
        ): Sprite

        addImageToSprite(
          image: Upload!
          width: Int!
          height: Int!
          pixelRatio: Int!
          spriteId: Int!
        ): Sprite
      }
    `,
    resolvers: {
      Mutation: {
        getOrCreateSprite: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          const { filename, createReadStream, mimetype, encoding } =
            await args.smallestImage;
          // @ts-ignore
          const hash = (await md5(createReadStream())).toString();
          // check whether sprite with same md5 already exists
          pgClient as DBClient;
          // if (args.pixelRatio > 1) {
          //   throw new Error("Must be called with an image with pixelRatio=1");
          // }
          const q = await pgClient.query(
            `select * from sprites where md5 = $1 and project_id = $2 and deleted = false`,
            [hash, args.projectId]
          );
          if (q.rows.length) {
            // if so, just return that sprite
            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`public.sprites`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.md5 = ${sql.value(
                      hash
                    )} and ${tableAlias}.project_id = ${sql.value(
                      args.projectId
                    )} and ${tableAlias}.deleted = false`
                  );
                }
              );
            return row;
          } else {
            // create a new one
            const url = await saveSpriteImage(
              createReadStream(),
              mimetype,
              `sprites/${uuid()}`
            );
            const r = await pgClient.query(
              `select create_sprite($1, $2, $3, $4, $5, $6, $7)`,
              [
                args.projectId,
                hash,
                args.type,
                args.pixelRatio,
                args.width,
                args.height,
                url,
              ]
            );
            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`public.sprites`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.md5 = ${sql.value(
                      hash
                    )} and ${tableAlias}.project_id = ${sql.value(
                      args.projectId
                    )} and ${tableAlias}.deleted = false`
                  );
                }
              );
            return row;
          }
        },
        addImageToSprite: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          const { filename, createReadStream, mimetype, encoding } =
            await args.image;
          // @ts-ignore
          const hash = (await md5(createReadStream())).toString();
          pgClient as DBClient;
          if (args.pixelRatio === 1) {
            throw new Error(
              "Use getOrCreateSprite with first image (pixelRatio=1)"
            );
          }
          // upload the image
          const url = await saveSpriteImage(
            createReadStream(),
            mimetype,
            `sprites/${uuid()}`
          );
          const q = await pgClient.query(
            `select add_image_to_sprite($1, $2, $3, $4, $5)`,
            [args.spriteId, args.pixelRatio, args.width, args.height, url]
          );
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.sprites`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(args.spriteId)}`
              );
            }
          );
          return row;
        },
      },
    },
  };
});

async function saveSpriteImage(
  stream: any,
  mimetype: string,
  filename: string
) {
  let ext = "jpg";
  if (mimetype === "image/png") {
    ext = "png";
  } else if (mimetype === "image/gif") {
    ext = "gif";
  }
  const url = `/${filename}.${ext}`;
  const { writeStream, promise } = uploadStream(filename + "." + ext, mimetype);
  if (
    mimetype !== "image/png" &&
    mimetype !== "image/jpeg" &&
    mimetype !== "image/gif"
  ) {
    throw new Error("Image must be of type PNG, JPEG, or GIF");
  }
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

const md5 = (stream: ReadableStream) => {
  return new Promise((resolve, reject) => {
    const hash = createHash("md5").setEncoding("hex");
    // @ts-ignore
    stream.pipe(hash);
    hash.on("finish", function () {
      resolve(hash.read());
    });
  });
};

function rowToSprite(row: any) {
  return {
    id: row.id,
    type: row.type,
    projectId: row.project_id,
    md5: row.md5,
  };
}

export default SpritesPlugin;
