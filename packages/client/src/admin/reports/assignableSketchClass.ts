/**
 * Sketch classes created for a survey spatial question. Their names look like
 * `generated-form-element-<id>`. They are not project sketch classes and must
 * not be offered as report assignment targets.
 */
export function isSurveyFormElementSketchClass(sketchClass: {
  formElementId?: number | null;
}): boolean {
  return sketchClass.formElementId != null;
}
