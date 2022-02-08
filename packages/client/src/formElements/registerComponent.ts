import { FormElementComponent } from "./FormElement";

type ColumnsFunction<T = any> = (
  componentSettings: T,
  exportId: string
) => string[];
type AnswersFunction<T = any, A = any> = (
  componentSettings: T,
  exportId: string,
  answer: A
) => { [column: string]: any };

export const components: {
  /** componentName must match form_elements db table */
  [componentName: string]: FormElementComponent<any, any>;
} = {};

type RuleValueFunction<T = any, V = any> = (
  value: V,
  componentSettings: T
) => any;

type ShouldDisplaySubordinateElementFunction<T = any, V = any> = (
  elementId: number,
  settings: T,
  answer: V
) => boolean;

export const componentExportHelpers: {
  [componentName: string]: {
    getColumns: ColumnsFunction<any>;
    getAnswers: AnswersFunction<any, any>;
    getValueForRuleEvaluation: RuleValueFunction<any, any>;
    shouldDisplaySubordinateElement: ShouldDisplaySubordinateElementFunction;
  };
} = {};

const defaultColumnsGetter = ((settings: any, exportId: string) => [
  exportId,
]) as ColumnsFunction;

const defaultAnswersGetter = (settings: any, exportId: string, answer: any) =>
  ({ [exportId]: answer } as AnswersFunction);

const defaultGetValueForRuleEvaluation = ((value: any) =>
  value) as RuleValueFunction;
const defaultShouldDisplaySubordinateElementFunction = () => false;

/**
 * registerComponent is used to maintain a list of FormElement component
 * implementations that can be used to construct Surveys and SketchClasses.
 * Simple components need only specify a component name and optionally a file
 * path. More complex components that have "compound answers" will need to
 * specify their exported columns and values, and what value should be used for
 * evaluating skip logic.
 * When registering a component you can also specify how subordinate elements
 * are displayed.
 * @param {Object} options
 */
export function registerComponent<ComponentSettingsType, AnswersType>(options: {
  /**
   * Component name.
   */
  name: string;
  /**
   * Filename that contains the component. If not specified, ./{name}.tsx will be used.
   */
  fname?: string;
  /**
   * Use to specify a list of column names that should be included in data export
   */
  getColumns?: ColumnsFunction<ComponentSettingsType>;
  /**
   * Specify a function that will transform a compound answer object into a list of values that match the columns specified by getColums()
   */
  getAnswers?: AnswersFunction<ComponentSettingsType, AnswersType>;
  /**
   * Function should return the value used to evaluate skip logic when given a compound answer.
   */
  getValueForRuleEvaluation?: RuleValueFunction<
    ComponentSettingsType,
    AnswersType
  >;
  /**
   * Determines whether a subordinate formElement should be displayed after this element. Useful for using componentSettings to control element visibility. For an example, see the SpatialAccessPriority implementation.
   */
  shouldDisplaySubordinateElement?: ShouldDisplaySubordinateElementFunction<
    ComponentSettingsType,
    AnswersType
  >;
}) {
  componentExportHelpers[options.name] = {
    getColumns: options.getColumns || defaultColumnsGetter,
    getAnswers: options.getAnswers || defaultAnswersGetter,
    getValueForRuleEvaluation:
      options.getValueForRuleEvaluation || defaultGetValueForRuleEvaluation,
    shouldDisplaySubordinateElement:
      options.shouldDisplaySubordinateElement ||
      defaultShouldDisplaySubordinateElementFunction,
  };
  // Only import the components if in browser, not node
  if (global.window) {
    import(
      /* webpackMode: "eager" */ `./${options.fname || options.name}.tsx`
    ).then((component) => {
      components[options.name] = component.default;
    });
  }
}
