/* eslint-disable i18next/no-literal-string */

export type UseCaseDefinition = {
  id: string;
  to: string;
  title: string;
  navLabel: string;
  readMoreLabel: string;
  summary: string;
  bullets: string[];
  /** Open Graph preview image */
  shareImage: string;
};

export const mapPortalHostingUseCase: UseCaseDefinition = {
  id: "map-portal-hosting",
  to: "/uses/map-portal-hosting",
  title: "Map Portal Hosting",
  navLabel: "Map Portal Hosting",
  readMoreLabel: "Read more about Map Portal Hosting",
  summary:
    "Host, visualize, and share spatial data. Create a common picture of your ocean environment.",
  bullets: [
    "Host vector and raster data",
    "Design approachable maps for stakeholders",
    "Manage metadata, versions, and access",
  ],
  shareImage:
    "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/af4df994-3ed3-4c4a-15f0-1c327eba1200/hlarge",
};

export const oceanUseSurveysUseCase: UseCaseDefinition = {
  id: "ocean-use-surveys",
  to: "/uses/ocean-use-surveys",
  title: "Ocean Use Surveys",
  navLabel: "Ocean Use Surveys",
  readMoreLabel: "Read more about Ocean Use Surveys",
  summary:
    "Collect local knowledge directly on the map—structured, spatial, analysis-ready. Run multi-language campaigns with ease.",
  bullets: [
    "Build spatial surveys for desktop and mobile",
    "Support multi-language campaigns",
    "Prepare survey data for analysis",
  ],
  shareImage:
    "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/f62cbeab-146a-463a-2b50-843acffec500/hlarge",
};

export const sketchingAndAnalysisUseCase: UseCaseDefinition = {
  id: "sketching-and-analysis",
  to: "/uses/sketching-and-analysis",
  title: "Sketching and Analysis",
  navLabel: "Sketching and Analysis",
  readMoreLabel: "Read more about Sketching and Analysis",
  summary:
    "Easy-to-use design and analysis tools empower stakeholders to effectively participate in a science-driven planning process.",
  bullets: [
    "Sketch zones and planning options",
    "Evaluate scenarios against spatial objectives",
    "Export results for GIS and reporting workflows",
  ],
  shareImage:
    "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/45106a3c-a728-4e0e-6dc1-71b2228f2400/hlarge",
};

export const useCaseLinks = [
  mapPortalHostingUseCase,
  oceanUseSurveysUseCase,
  sketchingAndAnalysisUseCase,
];
