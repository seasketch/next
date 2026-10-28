import { S3 } from "aws-sdk";
import { S3Client } from "@aws-sdk/client-s3";

function r2Settings() {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2_ENDPOINT / R2 credentials must be set");
  }
  return {
    endpoint: R2_ENDPOINT,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  };
}

/** aws-sdk v2 client for the data-path buckets. */
export function storageClientV2(): S3 {
  const settings = r2Settings();
  return new S3({
    region: "auto",
    endpoint: settings.endpoint,
    signatureVersion: "v4",
    s3ForcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}

/** aws-sdk v3 client for the data-path buckets. */
export function storageClientV3(): S3Client {
  const settings = r2Settings();
  return new S3Client({
    region: "auto",
    endpoint: settings.endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}

export function ownedBucketNames(): string[] {
  const names = [
    process.env.R2_TILES_BUCKET,
    process.env.SPATIAL_UPLOADS_BUCKET,
    process.env.BUCKET,
  ];
  const tilesRemote = process.env.TILES_REMOTE;
  if (tilesRemote && tilesRemote.startsWith("r2://")) {
    names.push(tilesRemote.replace(/^r2:\/\//, "").split("/")[0]);
  }
  return names.filter((name): name is string => !!name);
}

export function remoteBucket(remote: string): string | null {
  const match = /^(?:r2|s3):\/\/([^/]+)\//.exec(remote);
  return match ? match[1] : null;
}

/** True when this process's environment names the remote's bucket. */
export function ownsRemote(remote: string): boolean {
  const bucket = remoteBucket(remote);
  return bucket !== null && ownedBucketNames().includes(bucket);
}
