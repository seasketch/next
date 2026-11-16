import { isSurveyFormElementSketchClass } from "./assignableSketchClass";

describe("isSurveyFormElementSketchClass", () => {
  test("rejects survey-owned sketch classes", () => {
    expect(isSurveyFormElementSketchClass({ formElementId: 8938 })).toBe(true);
    expect(isSurveyFormElementSketchClass({ formElementId: 0 })).toBe(true);
  });

  test("keeps project sketch classes", () => {
    expect(isSurveyFormElementSketchClass({ formElementId: null })).toBe(
      false
    );
    expect(isSurveyFormElementSketchClass({ formElementId: undefined })).toBe(
      false
    );
    expect(isSurveyFormElementSketchClass({})).toBe(false);
  });
});
