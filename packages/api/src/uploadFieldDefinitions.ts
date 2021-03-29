import { FileUpload } from "graphql-upload";
import * as S3 from "aws-sdk/clients/s3";
import { v4 as uuid } from "uuid";
import stream from "stream";
import slugify from "slugify";

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
    }) =>
      (schema === "public" &&
        ((table === "projects" && column === "logo_url") ||
          (table === "sprites" && column === "url"))) ||
      (table === "basemaps" && column === "thumbnail"),
    resolve: resolveLogoUrlUpload,
  },
];

async function resolveLogoUrlUpload(upload: FileUpload) {
  const { filename, createReadStream, mimetype, encoding } = upload;
  const stream = createReadStream();
  const url = await savePublicImage(stream, mimetype, filename);
  return url;
}

async function savePublicImage(
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
