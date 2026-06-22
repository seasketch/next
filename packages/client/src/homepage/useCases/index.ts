import { mapPortalHostingUseCase } from "./MapPortalHosting";
import { oceanUseSurveysUseCase } from "./OceanUseSurveys";
import { sketchingAndAnalysisUseCase } from "./SketchingAndAnalysis";

export {
  default as MapPortalHostingPage,
  mapPortalHostingUseCase,
} from "./MapPortalHosting";
export {
  default as OceanUseSurveysPage,
  oceanUseSurveysUseCase,
} from "./OceanUseSurveys";
export {
  default as SketchingAndAnalysisPage,
  sketchingAndAnalysisUseCase,
} from "./SketchingAndAnalysis";

// Temporary launch mode:
// Keep only the Map Portal use case linked from homepage/nav until
// Ocean Use Surveys and Sketching pages are ready.
// To restore full behavior, set this to `true`.
export const enableAllUseCaseLinks = true;

export const useCaseLinks = [
  mapPortalHostingUseCase,
  oceanUseSurveysUseCase,
  sketchingAndAnalysisUseCase,
];

export const publishedUseCaseLinks = enableAllUseCaseLinks
  ? useCaseLinks
  : [mapPortalHostingUseCase];
