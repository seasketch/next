import { Logger } from "./logger";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { writeFileSync, createReadStream, createWriteStream } from "fs";
import { Readable } from "node:stream";

const s3Client = new S3Client({ region: process.env.AWS_REGION! });
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function putObject(
  filepath: string,
  remote: string,
  logger: Logger,
  increment?: number
) {
  if (!/r2:/.test(remote) && !/s3:/.test(remote)) {
    throw new Error(`Invalid remote ${remote}`);
  }
  const parts = remote.replace(/\w+:\/\//, "").split("/");
  const client = /r2:/.test(remote) ? r2Client : s3Client;
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  const fileStream = createReadStream(filepath);
  const uploadParams = {
    Bucket,
    Key,
    Body: fileStream,
  };
  const logmsg = `putObject ${filepath} to ${remote}`;
  logger.output += logmsg + "\n";
  await client.send(new PutObjectCommand(uploadParams));
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
  const parts = remote.replace("s3://", "").split("/");
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  // get s3 object size using a head request before running GetObject
  const headParams = {
    Bucket,
    Key,
  };
  const headResponse = await s3Client.send(new HeadObjectCommand(headParams));
  const fileSizeBytes = headResponse.ContentLength;
  logger.output += `getObject ${remote} to ${filepath}\n`;
  const response = await s3Client.send(
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
    throw new Error("Invalid response from s3");
  }
}
