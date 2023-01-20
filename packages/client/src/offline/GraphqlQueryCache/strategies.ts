import {
  UserIsSuperuserDocument,
  ProjectMetadataDocument,
  SurveyDocument,
} from "../../generated/queries";
import { byArgsStrategy, lruStrategy } from "./shared";

export const OFFLINE_SURVEYS_KEY = "selected-offline-surveys";

export const offlineSurveyChoiceStrategy = byArgsStrategy(
  SurveyDocument,
  OFFLINE_SURVEYS_KEY,
  {
    swr: true,
  }
);

export const surveyLRUStrategy = lruStrategy(SurveyDocument, 3, { swr: true });

export const strategies = [
  lruStrategy(ProjectMetadataDocument, 5, { swr: true }),
  lruStrategy(UserIsSuperuserDocument, 1, { swr: false }),
  surveyLRUStrategy,
  offlineSurveyChoiceStrategy,
];
