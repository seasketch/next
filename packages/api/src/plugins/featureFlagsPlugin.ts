import { makeExtendSchemaPlugin, gql } from "graphile-utils";

/**
 * Simple plugin just adds more explicit types to the feature_flags jsonb column
 */
const FeatureFlagsPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      type FeatureFlags {
        iNaturalistLayers: Boolean
      }

      extend type Project {
        featureFlags: FeatureFlags @requires(columns: ["feature_flags"])
      }
    `,
    resolvers: {
      Project: {
        featureFlags: async (project) => project.featureFlags,
      },
    },
  };
});

export default FeatureFlagsPlugin;
