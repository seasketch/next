import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import S3 from "aws-sdk/clients/s3";
import { objectKeyForTilePackageId } from "../offlineTilePackages/createTilePackage";

const s3 = new S3();

const OfflineTilePackagePlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      extend type OfflineTilePackage {
        """
        Can be used to download a tilepackage (if permitted)
        """
        presignedUrl: String!
      }
    `,
    resolvers: {
      OfflineTilePackage: {
        presignedUrl: async (parent, args, context, info) => {
          if (!process.env.TILE_PACKAGES_BUCKET) {
            throw new Error("TILE_PACKAGES_BUCKET env var not set");
          }
          const url = s3.getSignedUrl("getObject", {
            Bucket: process.env.TILE_PACKAGES_BUCKET,
            Key: objectKeyForTilePackageId(parent.id),
            Expires: 60 * 60, // 60 minutes
          });
          return url;
        },
      },
    },
  };
});

export default OfflineTilePackagePlugin;
