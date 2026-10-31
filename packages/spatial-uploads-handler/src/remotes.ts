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
import { describeStorageError, toError } from "./storageErrors";

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
    const owned = ownedBucketNames();
    throw new Error(
      `Refusing to access ${remote}: its bucket is not one this handler is ` +
        `configured for (${
          owned.length ? owned.join(", ") : "no buckets configured"
        }). Check the BUCKET, TILES_REMOTE and RESOURCES_REMOTE settings.`
    );
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
  try {
    // if file size is larger than 500MB, use multipart upload
    if (fileSizeBytes > 500 * 1024 * 1024) {
      logmsg += " Using multipart upload.";
      await putLargeObject(Bucket, Key, client, fileStream, fileSizeBytes);
    } else {
      await client.send(new PutObjectCommand(uploadParams));
    }
  } catch (e) {
    console.error(`putObject ${remote} failed`, e);
    const message = describeStorageError("upload", remote, e);
    logger.output += `${logmsg} FAILED: ${message}\n`;
    throw new Error(message);
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
  logger.output += `getObject ${remote} to ${filepath}\n`;
  let fileSizeBytes: number | undefined;
  let body: unknown;
  try {
    const headResponse = await client.send(
      new HeadObjectCommand({
        Bucket,
        Key,
      })
    );
    fileSizeBytes = headResponse.ContentLength;
    const response = await client.send(
      new GetObjectCommand({
        Bucket,
        Key,
      })
    );
    body = response.Body;
  } catch (e) {
    console.error(`getObject ${remote} failed`, e);
    const message = describeStorageError("fetch", remote, e);
    logger.output += `FAILED: ${message}\n`;
    throw new Error(message);
  }
  if (!(body instanceof Readable)) {
    throw new Error(
      `Failed to fetch ${remote}: storage returned ${
        body ? "a non-stream body" : "an empty body"
      }.`
    );
  }
  const stream = body;
  let downloadedBytes = 0;
  return new Promise((resolve, reject) => {
    const fail = (err: unknown) => {
      const message = describeStorageError("fetch", remote, err);
      logger.output += `FAILED: ${message}\n`;
      reject(new Error(message));
    };
    stream.on("data", (chunk) => {
      downloadedBytes += chunk.length;
      if (fileSizeBytes) {
        const chunkIncrement = chunk.length / fileSizeBytes;
        logger.updateProgress(chunkIncrement * finishedProgressValue);
      }
    });
    stream.on("error", fail);
    stream
      .pipe(createWriteStream(filepath))
      .on("error", fail)
      .on("close", () => {
        logger.updateProgress(finishedProgressValue);
        return resolve(filepath);
      });
  });
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

  // Let failures propagate. Swallowing them here would report a successful
  // upload for an object that was never written.
  try {
    await upload.done();
  } catch (error) {
    throw toError(error);
  }
  console.log("Upload completed successfully!");
}
