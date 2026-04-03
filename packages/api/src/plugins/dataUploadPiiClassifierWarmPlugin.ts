import { makeWrapResolversPlugin } from "postgraphile";
import { warmGeostatsPiiClassifier } from "../geostatsPiiClassifierWarm";

/**
 * After a successful createDataUpload mutation, ping the geostats PII classifier
 * Lambda with a no-op warm payload (async invoke) to reduce cold-start impact
 * when the upload finishes and the spatial handler classifies geostats.
 */
const DataUploadPiiClassifierWarmPlugin = makeWrapResolversPlugin({
  Mutation: {
    createDataUpload: async (resolve, source, args, context, resolveInfo) => {
      const result = await resolve(source, args, context, resolveInfo);
      warmGeostatsPiiClassifier();
      return result;
    },
  },
});

export default DataUploadPiiClassifierWarmPlugin;
