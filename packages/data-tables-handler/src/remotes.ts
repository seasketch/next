import { createReadStream, statSync } from "fs";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import bytes from "bytes";
import { Readable } from "stream";

const s3Client = new S3Client({ region: process.env.AWS_REGION! });
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function putObject(filepath: string, remote: string) {
  if (!/r2:/.test(remote) && !/s3:/.test(remote)) {
    throw new Error(`Invalid remote ${remote}`);
  }
  const parts = remote.replace(/\w+:\/\//, "").split("/");
  const client = /r2:/.test(remote) ? r2Client : s3Client;
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  const fileSizeBytes = statSync(filepath).size;
  const fileStream = createReadStream(filepath);
  if (fileSizeBytes > 500 * 1024 * 1024) {
    const upload = new Upload({
      client,
      params: { Bucket, Key, Body: fileStream },
    });
    await upload.done();
  } else {
    await client.send(
      new PutObjectCommand({ Bucket, Key, Body: fileStream }),
    );
  }
  console.log(`putObject ${filepath} (${bytes(fileSizeBytes)}) to ${remote}`);
}

export async function getObject(filepath: string, remote: string) {
  const isR2 = /r2:/.test(remote);
  const parts = remote.replace(/\w+:\/\//, "").split("/");
  const client = isR2 ? r2Client : s3Client;
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  const response = await client.send(
    new GetObjectCommand({ Bucket, Key }),
  );
  const body = response.Body as Readable;
  const { createWriteStream } = await import("fs");
  const { pipeline } = await import("stream/promises");
  await pipeline(body, createWriteStream(filepath));
}

export async function getStagingObject(
  filepath: string,
  objectKey: string,
): Promise<void> {
  const bucket = process.env.BUCKET!;
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
  );
  const body = response.Body as Readable;
  const { createWriteStream } = await import("fs");
  const { pipeline } = await import("stream/promises");
  await pipeline(body, createWriteStream(filepath));
}

export function buildR2Remote(slug: string, uploadId: string, filename: string) {
  const bucket = process.env.R2_TILES_BUCKET || process.env.TILES_REMOTE?.replace("r2://", "").split("/")[0];
  if (!bucket) {
    throw new Error("R2_TILES_BUCKET or TILES_REMOTE must be set");
  }
  const key = `projects/${slug}/public/dataTables/${uploadId}/${filename}`;
  return { remote: `r2://${bucket}/${key}`, key, bucket };
}
