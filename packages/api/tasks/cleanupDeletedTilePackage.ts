import { Helpers } from "graphile-worker";
import {
  createTilePackage,
  objectKeyForTilePackageId,
} from "../src/offlineTilePackages/createTilePackage";
import S3 from "aws-sdk/clients/s3";

const s3 = new S3();

export default async (payload: { packageId: string }, helpers: Helpers) => {
  const { packageId } = payload;
  helpers.logger.info(`Deleting tile package: ${packageId}`);
  await helpers.withPgClient(async (client) => {
    if (!process.env.TILE_PACKAGES_BUCKET) {
      throw new Error("TILE_PACKAGES_BUCKET env var not set");
    }
    try {
      const response = await s3
        .deleteObject({
          Bucket: process.env.TILE_PACKAGES_BUCKET,
          Key: objectKeyForTilePackageId(packageId),
        })
        .promise();
    } catch (e) {
      console.error(`Problem deleting tile package ${packageId}`);
    }
  });
};
