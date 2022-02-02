import languages from "../lang/supported";

export const TestSurveyContextValue = {
  isAdmin: false,
  isFacilitatedResponse: false,
  surveySupportsFacilitation: true,
  projectName: "Project A",
  projectUrl: "https://example.com/a",
  surveyUrl: "https://example.com/a/",
  bestName: "John Doe",
  bestEmail: "jdoe@example.com",
  supportedLanguages: [],
  lang: languages.find((lang) => lang.code === "EN")!,
  setLanguage: (code: string) => null,
  practiceMode: false,
  togglePracticeMode: (enabled: boolean) => {},
  toggleFacilitation: (enabled: boolean) => {},
  surveyId: 0,
  slug: "",
};
