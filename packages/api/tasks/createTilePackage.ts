import { Helpers } from "graphile-worker";
import { createTilePackage } from "../src/offlineTilePackages/createTilePackage";

export default async (payload: { packageId: string }, helpers: Helpers) => {
  const { packageId } = payload;
  helpers.logger.info(`Creating tile package: ${packageId}`);
  await helpers.withPgClient(async (client) => {
    await createTilePackage(packageId, client);
  });
};
