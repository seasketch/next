import { ProjectMetadataDocument } from "../../generated/queries";
import { byArgsStrategy, lruStrategy } from ".";

export const strategies = [
  lruStrategy(ProjectMetadataDocument, 8, { swr: true }),
  byArgsStrategy(ProjectMetadataDocument, "selected-offline-projects", {
    swr: true,
  }),
];
