import bytes from "bytes";
import { Logger } from "./logger";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { writeFileSync, createReadStream, createWriteStream } from "fs";
import { ReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { Upload } from "@aws-sdk/lib-storage";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function bucketFromRemote(remote: string | undefined): string | undefined {
  if (!remote) return undefined;
  const match = /^(?:r2|s3):\/\/([^/]+)/.exec(remote);
  return match?.[1];
}

function ownedBucketNames(): string[] {
  const names = [
    process.env.R2_TILES_BUCKET,
    process.env.SPATIAL_UPLOADS_BUCKET,
    process.env.BUCKET,
    bucketFromRemote(process.env.TILES_REMOTE),
    bucketFromRemote(process.env.RESOURCES_REMOTE),
  ];
  return names.filter((name): name is string => !!name);
}

function ownsRemote(remote: string): boolean {
  const match = /^(?:r2|s3):\/\/([^/]+)\//.exec(remote);
  return match !== null && ownedBucketNames().includes(match[1]);
}

function assertOwned(remote: string) {
  if (!ownsRemote(remote)) {
    throw new Error(`Refusing to access foreign remote ${remote}`);
  }
}

export function presignStagedGet(
  bucket: string,
  key: string,
  expiresIn: number
): Promise<string> {
  return getSignedUrl(
    r2Client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}

export async function putObject(
  filepath: string,
  remote: string,
  logger: Logger,
  increment?: number
) {
  if (!/r2:/.test(remote) && !/s3:/.test(remote)) {
    throw new Error(`Invalid remote ${remote}`);
  }
  assertOwned(remote);
  const parts = remote.replace(/\w+:\/\//, "").split("/");
  const client = r2Client;
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  const fileSizeBytes = statSync(filepath).size;
  const fileStream = createReadStream(filepath);
  const uploadParams = {
    Bucket,
    Key,
    Body: fileStream,
  };
  let logmsg = `putObject ${filepath} (${bytes(fileSizeBytes)}) to ${remote}.`;
  // if file size is larger than 500MB, use multipart upload
  if (fileSizeBytes > 500 * 1024 * 1024) {
    logmsg += " Using multipart upload.";
    await putLargeObject(Bucket, Key, client, fileStream, fileSizeBytes);
  } else {
    await client.send(new PutObjectCommand(uploadParams));
  }
  logger.output += logmsg + "\n";
  if (increment) {
    logger.updateProgress(increment);
  }
}

export async function getObject(
  filepath: string,
  remote: string,
  logger: Logger,
  finishedProgressValue: number
): Promise<string> {
  if (!/r2:/.test(remote) && !/s3:/.test(remote)) {
    throw new Error(`Invalid remote ${remote}`);
  }
  assertOwned(remote);
  const parts = remote.replace(/\w+:\/\//, "").split("/");
  const client = r2Client;
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  const headResponse = await client.send(
    new HeadObjectCommand({
      Bucket,
      Key,
    })
  );
  const fileSizeBytes = headResponse.ContentLength;
  logger.output += `getObject ${remote} to ${filepath}\n`;
  const response = await client.send(
    new GetObjectCommand({
      Bucket,
      Key,
    })
  );
  const initialProgress = parseFloat(logger.currentProgress.toString());
  const finishedProgressIncrement =
    initialProgress <= 0
      ? finishedProgressValue
      : initialProgress - finishedProgressValue;
  let downloadedBytes = 0;
  if (response.Body) {
    return new Promise((resolve, reject) => {
      if (response.Body instanceof Readable) {
        response.Body.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          if (fileSizeBytes) {
            const progressFraction = downloadedBytes / fileSizeBytes;
            const chunkIncrement = chunk.length / fileSizeBytes;
            logger.updateProgress(chunkIncrement * finishedProgressValue);
          }
        });
        response.Body.pipe(createWriteStream(filepath))
          .on("error", (err) => reject(err))
          .on("close", () => {
            logger.updateProgress(finishedProgressValue);
            return resolve(filepath);
          });
      }
    });
  } else {
    throw new Error("Invalid response from storage");
  }
}

async function putLargeObject(
  Bucket: string,
  Key: string,
  client: S3Client,
  Body: ReadStream,
  fileSize: number
) {
  const minPartSize = 5 * 1024 * 1024; // 5MB minimum part size
  const maxPartSize = 500 * 1024 * 1024; // 500MB maximum part size

  // Compute optimal part size: aim for parts no larger than 500MB and no smaller than 5MB
  let partSize = Math.ceil(fileSize / Math.ceil(fileSize / maxPartSize));
  if (partSize < minPartSize) {
    partSize = minPartSize; // Ensure parts are at least 5MB
  }

  try {
    const upload = new Upload({
      client,
      params: {
        Bucket,
        Key,
        Body,
      },
      partSize, // Enforce part size constraint
      queueSize: 5, // Number of parallel uploads
    });

    upload.on("httpUploadProgress", (progress) => {
      console.log(`Uploaded ${progress.loaded} of ${progress.total}`);
    });

    await upload.done();
    console.log("Upload completed successfully!");
  } catch (error) {
    console.error("Upload failed:", error);
  }
}
