import { Schema, Node, DOMSerializer } from "prosemirror-model";
import {
  Component,
  createContext,
  FunctionComponent,
  lazy,
  ReactElement,
  ReactNode,
  Suspense,
  useContext,
  useEffect,
  useRef,
} from "react";
import { schema as baseSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { createPortal } from "react-dom";
import {
  CreateResponseMutation,
  FormElement,
  FormElementDetailsFragment,
  FormElementLayout,
  Maybe,
  Sketch,
  SketchClassDetailsFragment,
  UpdateFormElementMutation,
  useUpdateFormElementMutation,
  useUpdateFormElementSketchClassMutation,
  useUpdateSurveyBaseSettingsMutation,
} from "../generated/graphql";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { FetchResult, MutationResult } from "@apollo/client";
import { formElements as editorConfig } from "../editor/config";
import Spinner from "../components/Spinner";
import { Trans } from "react-i18next";
import {
  MapContext,
  MapContextInterface,
} from "../dataLayers/MapContextManager";
import {
  BBox,
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import { LngLatBoundsLike } from "mapbox-gl";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
import languages, { LangDetails } from "../lang/supported";
import set from "lodash.set";
import deepCopy from "lodash.clonedeep";
import { components } from ".";

require("./prosemirror-body.css");
require("./unreset.css");
const LazyBodyEditor = lazy(() => import("./BodyEditor"));

export const FormEditorPortalContext = createContext<{
  container: HTMLDivElement | null;
  formElementSettings: any;
  surveyId: number;
} | null>(null);

export const SurveyButtonFooterPortalContext = createContext<HTMLDivElement | null>(
  null
);

export const SurveyMapPortalContext = createContext<HTMLDivElement | null>(
  null
);

/**
 * Common props that will be supplied to all FormElement React Component
 * implementations. Components should use the ComponentSettings and ValueType
 * generics to narrow types down further.
 */
export interface FormElementProps<ComponentSettings, ValueType = {}> {
  id: number;
  /** ProseMirror document */
  body: any;
  isRequired: boolean;
  componentSettings: ComponentSettings;
  alternateLanguageSettings: { [key: string]: any };
  value?: ValueType;
  editable?: boolean;
  onChange: (
    value: ValueType | undefined,
    validationErrors: boolean,
    advanceAutomatically?: boolean
  ) => void;
  /**
   * Set to true by SurveyApp if user attempts to proceed. Useful for showing validation messages only
   * after the user has finished their input
   * */
  submissionAttempted?: boolean;
  /**
   * Used to request that the controller advance to the next question. For example, on Enter keydown
   */
  onSubmit: () => void;
  isSpatial: boolean;
  sketchClass?: SketchClassDetailsFragment | null;
  featureNumber: number;
  onRequestStageChange: (stage: number) => void;
  stage: number;
  /** Component requests advancement to the next question */
  onRequestNext: () => void;
  /** Component requests navigation to the previous question */
  onRequestPrevious: () => void;
  autoFocus?: boolean;
  /** Set to true if this is the last question in a survey */
  isLastQuestion?: boolean;
}

/**
 * ProseMirror schema used for FormElement.body content
 */
// export const schema: Schema = new Schema({
//   nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
//   marks: baseSchema.spec.marks,
// });

/**
 * Render the given document for presentation to the user
 *
 * @param body ProseMirror Node/Document
 */
export function FormElementBody({
  body: defaultBody,
  required,
  isInput,
  editable,
  formElementId,
  componentSettings,
  componentSettingName,
  alternateLanguageSettings,
}: {
  formElementId: number;
  body: any;
  required?: boolean;
  isInput: boolean;
  editable?: boolean;
  componentSettings?: any;
  componentSettingName?: string;
  alternateLanguageSettings: any;
}) {
  const schema = isInput
    ? editorConfig.questions.schema
    : editorConfig.content.schema;
  const target = useRef<HTMLDivElement>(null);
  const serializer = useRef(DOMSerializer.fromSchema(schema));
  const context = useContext(SurveyContext);

  let body = defaultBody;
  if (
    context &&
    context?.lang?.code !== "EN" &&
    alternateLanguageSettings[context?.lang?.code]
  ) {
    body = alternateLanguageSettings[context?.lang?.code][
      componentSettingName || "body"
    ] || {
      ...defaultBody,
    };
  }

  useEffect(() => {
    if (target.current && document) {
      target.current.innerHTML = "";
      target.current.appendChild(
        serializer.current.serializeFragment(
          Node.fromJSON(schema, body).content
        )
      );
    }
  }, [target, body]);

  if (editable) {
    return (
      <div
        className={`prosemirror-body ${required && "required"} ${
          isInput && "input"
        }`}
        style={{ minWidth: 300 }}
      >
        <Suspense fallback={<Spinner />}>
          <LazyBodyEditor
            formElementId={formElementId}
            body={body}
            isInput={isInput}
            componentSettingName={componentSettingName}
            componentSettings={componentSettings}
            alternateLanguageSettings={alternateLanguageSettings}
          />
        </Suspense>
      </div>
    );
  } else {
    return (
      <div
        className={`prosemirror-body ${required && "required"} ${
          isInput && "input"
        }`}
        ref={target}
      ></div>
    );
  }
}

type FormElementRenderer = (
  updateBaseSetting: (
    setting: "body" | "isRequired" | "exportId" | "typeId"
  ) => (value: any) => void,
  updateComponentSetting: (
    setting: string,
    currentSettings: any,
    language?: string,
    alternateLanguageSettings?: any
  ) => (value: any) => void,
  updateSurveySettings: (settings: {
    showFacilitationOption?: boolean;
    showProgress?: boolean;
  }) => void,
  updateSketchClass: (
    settings: Pick<SketchClassDetailsFragment, "geometryType">
  ) => void
) => ReactNode;
export class FormElementEditorPortal extends Component<{
  render: FormElementRenderer;
}> {
  static contextType = FormEditorPortalContext;
  render() {
    const container = this.context?.container;
    if (container) {
      return createPortal(
        <FormElementEditorContainer
          surveyId={this.context?.surveyId}
          render={this.props.render}
        />,
        container
      );
    } else {
      return null;
    }
  }
}

export const SurveyMapPortal: FunctionComponent<{
  mapContext: MapContextInterface;
}> = (props) => {
  const portalContext = useContext(SurveyLayoutContext).mapPortal;
  if (portalContext) {
    return createPortal(
      <MapContext.Provider value={props.mapContext}>
        {props.children}
      </MapContext.Provider>,
      portalContext
    );
  } else {
    return null;
  }
};
// export class SurveyMapPortal extends Component<{
//   render: () => ReactNode;
//   mapContext: MapContextInterface;
// }> {
//   static contextType = SurveyMapPortalContext;
//   render() {
//     const container = this.context?.container;
//     if (container) {
//       return createPortal(
//         <MapContext.Provider value={this.props.mapContext}>
//           {this.props.render()}
//         </MapContext.Provider>,
//         container
//       );
//     } else {
//       return null;
//     }
//   }
// }

function FormElementEditorContainer({
  render,
  surveyId,
}: {
  surveyId: number;
  render: FormElementRenderer;
}) {
  const context = useContext(FormEditorPortalContext);
  const onError = useGlobalErrorHandler();
  const [
    updateBaseSetting,
    updateComponentSetting,
    mutationState,
  ] = useUpdateFormElement(context?.formElementSettings);
  const [
    updateSurvey,
    updateSurveyState,
  ] = useUpdateSurveyBaseSettingsMutation();
  const [
    updateSketchClass,
    updateSketchClassState,
  ] = useUpdateFormElementSketchClassMutation({
    onError,
  });
  return (
    <div className="space-y-4 text-sm p-3">
      {render(
        updateBaseSetting,
        updateComponentSetting,
        (settings) =>
          updateSurvey({
            variables: {
              id: surveyId,
              ...settings,
            },
          }),
        (settings: Pick<SketchClassDetailsFragment, "geometryType">) => {
          updateSketchClass({
            variables: {
              id: context!.formElementSettings.sketchClass.id,
              ...settings,
            },
            optimisticResponse: (data) => ({
              __typename: "Mutation",
              updateSketchClass: {
                __typename: "UpdateSketchClassPayload",
                sketchClass: {
                  __typename: "SketchClass",
                  ...context!.formElementSettings.sketchClass,
                  ...data,
                },
              },
            }),
          });
        }
      )}
    </div>
  );
}

interface ChildOptionsFactoryProps extends FormElementDetailsFragment {
  child: FormElementDetailsFragment;
}
export function ChildOptionsFactory(props: ChildOptionsFactoryProps) {
  const [
    updateBaseSetting,
    updateComponentSetting,
    updateFormElementState,
  ] = useUpdateFormElement(props);
  const C = components[props.typeId];
  if (C.ChildOptions) {
    return (
      <C.ChildOptions
        child={props.child}
        componentSettings={props.componentSettings}
        updateComponentSetting={updateComponentSetting}
      />
    );
  } else {
    return null;
  }
}

export function useUpdateFormElement(
  data?: Pick<
    FormElement,
    | "body"
    | "componentSettings"
    | "id"
    | "isRequired"
    | "typeId"
    | "alternateLanguageSettings"
  >
): [
  (
    setting: "body" | "isRequired" | "exportId" | "typeId"
  ) => (value: any) => void,
  (
    setting: string,
    currentSettings: any,
    language?: string,
    alternateLanguageSettings?: any
  ) => (value: any) => void,
  MutationResult<UpdateFormElementMutation>
] {
  const onError = useGlobalErrorHandler();
  const [
    updateFormElement,
    updateFormElementState,
  ] = useUpdateFormElementMutation();
  const updater = (
    variables: Partial<
      Pick<
        FormElement,
        | "body"
        | "componentSettings"
        | "isRequired"
        | "exportId"
        | "typeId"
        | "alternateLanguageSettings"
      >
    >
  ) => {
    if (!data) {
      throw new Error("FormElement settings context not set");
    }
    updateFormElement({
      variables: {
        ...variables,
        id: data.id,
      },
      onError,
      optimisticResponse: {
        updateFormElement: {
          formElement: {
            ...data,
            ...variables,
          },
        },
      },
    }).catch((e) => onError(e));
  };
  const updateBaseSetting = (
    setting: "body" | "isRequired" | "exportId" | "typeId"
  ) => {
    return (value: any) => updater({ [setting]: value });
  };
  const updateComponentSetting = (
    setting: string,
    currentSettings: FormElementProps<any>,
    language?: string,
    alternateLanguageSettings?: any
  ) => (value: any) => {
    if (language && !alternateLanguageSettings) {
      throw new Error(
        `Specified language ${language} but not current alternateLanguageSettings`
      );
    }

    if (!language || language === "EN") {
      const newSettings = deepCopy(currentSettings);
      set(newSettings, setting, value);
      // @ts-ignore
      window.newSettings = newSettings;
      // @ts-ignore
      window.set = set;
      updater({ componentSettings: newSettings });
    } else {
      const newSettings = deepCopy(alternateLanguageSettings[language]);
      set(newSettings, setting, value);
      updater({
        alternateLanguageSettings: {
          ...alternateLanguageSettings,
          [language]: {
            ...newSettings,
          },
        },
      });
    }
  };
  return [updateBaseSetting, updateComponentSetting, updateFormElementState];
}

export interface FormElementComponent<T, V = {}>
  extends React.FunctionComponent<FormElementProps<T, V>> {
  /** Used to describe component in admin editor. Must be a <Trans /> element type */
  label: ReactElement;
  /** Used to describe component in admin editor. Must be a <Trans /> element type */
  description: ReactElement;
  /** Use fromMarkdown function to create a ProseMirror Document */
  defaultBody: any;
  /* Can be useful for certain fields like `email` */
  defaultExportId?: string;
  defaultIsRequired?: boolean;
  defaultComponentSettings?: T;
  /** For components like WelcomeMessage that shouldn't be a user option */
  templatesOnly?: boolean;
  /**
   * When set to true, Next/Skip buttons are not displayed and the component is
   * responsible for indicating when to advance using the third argument of
   * props.onChange
   * */
  advanceAutomatically?: boolean | ((componentSettings: T) => boolean);
  icon: FunctionComponent<{
    componentSettings: T;
    sketchClass?: SketchClassDetailsFragment | undefined | null;
  }>;
  /**
   * Used in the admin interface to define skip logic. If not specified, a default text
   * input will be used.
   * For example, when using the Number input you may want to skip ahead in the survey if
   * the value is greater than a certain value. To specify that value, the adminValueInput
   * will be used. The default text input isn't great. An <input type="number" /> is better,
   * and if the componentSettings specify a small range, a dropdown may be even better.
   */
  adminValueInput?: React.FunctionComponent<{
    onChange: (value: V) => void;
    value: V;
    componentSettings: T;
  }>;
  /**
   * FormElements can have different "stages" of user interaction. For example, a spatial input
   * may have a stage for digitizing a shape, for showing a list of input shapes, and for showing
   * introductory information. FormElement components will be passed a onRequestStageChange function.
   * Enumerating stages makes it easy to represent different pages in the admin interface so that
   * text and other aspects of the FormElement can be customized
   */
  stages?: { [stage: number]: string };
  hideNav?:
    | boolean
    | ((componentSettings: T, isMobile: boolean, stage?: number) => boolean);
  getLayout?: (
    stage: number,
    componentSettings: T,
    defaultLayout: FormElementLayout,
    isSmall: boolean
  ) => FormElementLayout | null;
  /** Will disable option in admin interface to delete the element. Useful for welcome message, thank you, etc that are created as part of templates */
  disableDeletion?: boolean;
  getInitialStage?: (value: V, componentSettings: T) => number;
  ChildOptions?: FunctionComponent<{
    componentSettings: T;
    child: {
      typeId: string;
      componentSettings: any;
      id: number;
      subordinateTo?: Maybe<number>;
    };
    updateComponentSetting: (
      setting: string,
      currentSettings: any,
      language?: string | undefined,
      alternateLanguageSettings?: any
    ) => (value: any) => void;
  }>;
  getValueForRuleEvaluation?: (value: V, componentSettings: T) => any;
  shouldDisplaySubordinateElement?: (
    elementId: number,
    componentSettings: T,
    value?: V
  ) => boolean;
}

export function hideNav(
  Component: FormElementComponent<any, any>,
  componentSettings: any,
  isMobile: boolean,
  stage?: number
) {
  if (Component.hideNav === undefined) {
    return false;
  } else if (Component.hideNav === false) {
    return false;
  } else if (Component.hideNav === true) {
    return true;
  } else if (typeof Component.hideNav === "function") {
    return Component.hideNav(componentSettings, isMobile, stage);
  } else {
    throw new Error("Component has invalid hideNav Class property");
  }
}

// eslint-disable-next-line i18next/no-literal-string
export const adminValueInputCommonClassNames = `bg-transparent border-none focus:ring-0 focus:border-none focus:outline-none focus:bg-blue-900 focus:bg-opacity-10 w-full text-center`;

export const defaultFormElementIcon = (
  <div className="bg-gray-200 w-full h-full text-gray-50 font-bold text-center flex justify-center items-center">
    {/* eslint-disable-next-line i18next/no-literal-string */}
    <span>D</span>
  </div>
);

export function sortFormElements<
  T extends {
    position: number;
    typeId: string;
  }
>(elements: T[]) {
  if (elements.length === 0) {
    return [];
  }
  const Welcome = elements.find((el) => el.typeId === "WelcomeMessage");
  const ThankYou = elements.find((el) => el.typeId === "ThankYou");
  const SaveScreen = elements.find((el) => el.typeId === "SaveScreen");
  const FeatureName = elements.find((el) => el.typeId === "FeatureName");
  const SAPRange = elements.find((el) => el.typeId === "SAPRange");
  const Consent = elements.find((el) => el.typeId === "Consent");
  const bodyElements = elements.filter(
    (el) =>
      el.typeId !== "WelcomeMessage" &&
      el.typeId !== "ThankYou" &&
      el.typeId !== "SaveScreen" &&
      el.typeId !== "FeatureName" &&
      el.typeId !== "SAPRange" &&
      el.typeId !== "Consent"
  );
  bodyElements.sort((a, b) => {
    return a.position - b.position;
  });
  const pre: T[] = [];
  const post: T[] = [];
  if (Welcome) {
    pre.push(Welcome);
  }
  if (Consent) {
    pre.push(Consent);
  }
  if (FeatureName) {
    pre.push(FeatureName);
  }
  if (SAPRange) {
    pre.push(SAPRange);
  }
  if (SaveScreen) {
    post.push(SaveScreen);
  }
  if (ThankYou) {
    post.push(ThankYou);
  }
  if (Welcome || ThankYou) {
    if (!Welcome) {
      throw new Error("WelcomeMessage FormElement not in Form");
    }
    if (!ThankYou) {
      throw new Error("ThankYou FormElement not in Form");
    }
    if (!SaveScreen) {
      throw new Error("SaveScreen FormElement is not in Form");
    }
    return [...pre, ...bodyElements, ...post] as T[];
  } else {
    return [...pre, ...bodyElements, ...post] as T[];
  }
}

export const SurveyContext = createContext<{
  surveyId: number;
  slug: string;
  isAdmin: boolean;
  projectName: string;
  projectUrl: string;
  surveyUrl: string;
  surveySupportsFacilitation: boolean;
  isFacilitatedResponse: boolean;
  bestName?: string;
  bestEmail?: string;
  projectBounds?: BBox;
  saveResponse?: () => Promise<
    FetchResult<
      CreateResponseMutation,
      Record<string, any>,
      Record<string, any>
    >
  >;
  resetResponse?: () => Promise<void>;
  savingResponse?: boolean;
  /**
   * Survey's supported languages
   * Current languge can be gotten from the useTranslation() hook
   * */
  supportedLanguages: string[];
  lang: LangDetails;
  setLanguage: (code: string) => void;
  practiceMode: boolean;
  togglePracticeMode: (enable: boolean) => void;
  toggleFacilitation: (enable: boolean) => void;
} | null>(null);

export function getLayout(
  formElement: Pick<
    FormElementDetailsFragment,
    "backgroundImage" | "layout" | "type"
  >
): FormElementLayout {
  if (formElement.layout) {
    return formElement.layout!;
  } else if (formElement.type?.allowedLayouts?.length) {
    return formElement.type.allowedLayouts[0]!;
  } else {
    return FormElementLayout.Top;
  }
}

export type UnsavedSketchProps = {
  name: string;
  // Maybe this should rather be a seperate cache in the client somewhere?
  // or so fast, it's a rendering concern and needs no caching ;)
  // preprocessedGeometry: Geometry;
  [exportid: string]: any;
};

export type UnsavedSketches = FeatureCollection<any, UnsavedSketchProps>;

export function toFeatureCollection(
  features: Feature<any, any>[],
  autoGenerateNames?: boolean
) {
  if (autoGenerateNames) {
    for (const feature of features) {
      if (!feature.properties.name) {
        // eslint-disable-next-line i18next/no-literal-string
        feature.properties.name = `Location ${features.indexOf(feature)}`;
      }
    }
  }
  return ({
    type: "FeatureCollection",
    features,
  } as unknown) as FeatureCollection<any, UnsavedSketchProps>;
}

export function useLocalizedComponentSetting(
  propName: string,
  props: Pick<
    FormElementProps<any, any>,
    "alternateLanguageSettings" | "componentSettings"
  >
) {
  const context = useContext(SurveyContext);
  if (
    !context?.lang ||
    !props.alternateLanguageSettings[context.lang.code] ||
    context?.lang?.code === "EN"
  ) {
    return props.componentSettings[propName];
  } else {
    return (
      props.alternateLanguageSettings[context.lang.code][propName] ||
      props.componentSettings[propName]
    );
  }
}
