import {
  ProjectMetadataDocument,
  GetBasemapsDocument,
  SurveyDocument,
} from "../../generated/queries";
import { byArgsStrategy, lruStrategy } from ".";

export const strategies = [
  lruStrategy(ProjectMetadataDocument, 3, { swr: true }),
  lruStrategy(SurveyDocument, 3, { swr: true }),
  byArgsStrategy(ProjectMetadataDocument, "selected-offline-projects", {
    swr: true,
  }),
];
