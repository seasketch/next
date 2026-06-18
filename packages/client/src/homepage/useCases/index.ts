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

export const useCaseLinks = [
  mapPortalHostingUseCase,
  oceanUseSurveysUseCase,
  sketchingAndAnalysisUseCase,
];
