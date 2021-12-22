import { FileUpload } from "graphql-upload";
import * as S3 from "aws-sdk/clients/s3";
import { v4 as uuid } from "uuid";
import stream from "stream";
import sharp from "sharp";

const s3 = new S3.default({
  region: process.env.S3_REGION,
  // TODO: Use ec2/fargate perms in production
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

export default [
  {
    match: ({
      schema,
      table,
      column,
      tags,
    }: {
      schema: string;
      table: string;
      column: string;
      tags: string[];
    }) => {
      if (schema === "public") {
        if (table === "projects" && column === "logo_url") {
          return true;
        }
        if (table === "sprites" && column === "url") {
          return true;
        }
        if (table === "basemaps" && column === "thumbnail") {
          return true;
        }
        if (table === "user_profiles" && column === "picture") {
          return true;
        }
      }
      return false;
    },
    resolve: resolveLogoUrlUpload,
  },
];

async function resolveLogoUrlUpload(
  upload: FileUpload,
  args: any,
  context: any,
  info: any
) {
  const { filename, createReadStream, mimetype, encoding } = upload;
  const stream = createReadStream();
  const url = await savePublicImage(
    stream,
    mimetype,
    filename,
    Object.keys(args.input.patch || {}).indexOf("picture") !== -1
  );
  return url;
}

export async function savePublicImage(
  stream: any,
  mimetype: string,
  filename: string,
  resize?: boolean
) {
  let ext = "jpg";
  if (mimetype === "image/png") {
    ext = "png";
  } else if (mimetype === "image/gif") {
    ext = "gif";
  }
  const key = `${uuid()}.${ext}`;
  const url = `https://${process.env.PUBLIC_UPLOADS_DOMAIN}/${key}`;
  const { writeStream, promise } = uploadStream(key, mimetype);
  if (
    mimetype !== "image/png" &&
    mimetype !== "image/jpeg" &&
    mimetype !== "image/gif"
  ) {
    throw new Error("Image must be of type PNG, JPEG, or GIF");
  }
  if (resize) {
    const avatarResizer = sharp().resize(128);
    stream
      .pipe(avatarResizer)
      .pipe(writeStream)
      .on("error", (error: Error) => {
        throw error;
      });
  } else {
    stream.pipe(writeStream).on("error", (error: Error) => {
      throw error;
    });
  }
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

async function resolveAvatarUrlUpload(upload: FileUpload) {
  const { filename, createReadStream, mimetype, encoding } = upload;
  const stream = createReadStream();
  // stream.pipe(avatarResizer);
  const url = await savePublicImage(stream, mimetype, filename);
  return url;
}
