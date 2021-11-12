import { Schema, Node, DOMSerializer } from "prosemirror-model";
import {
  Component,
  createContext,
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
  FormElement,
  UpdateFormElementMutation,
  useUpdateFormElementMutation,
  useUpdateSurveyBaseSettingsMutation,
} from "../generated/graphql";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { MutationResult } from "@apollo/client";
import { formElements as editorConfig } from "../editor/config";
import Spinner from "../components/Spinner";
import { Trans } from "react-i18next";
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
  value?: ValueType;
  editable?: boolean;
  onChange: (value: ValueType | undefined, validationErrors: boolean) => void;
  /**
   * Set to true by SurveyApp if user attempts to proceed. Useful for showing validation messages only
   * after the user has finished their input
   * */
  submissionAttempted?: boolean;
  /**
   * Used to request that the controller advance to the next question. For example, on Enter keydown
   */
  onSubmit: () => void;
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
  body,
  required,
  isInput,
  editable,
  formElementId,
  componentSettings,
  componentSettingName,
}: {
  formElementId: number;
  body: any;
  required?: boolean;
  isInput: boolean;
  editable?: boolean;
  componentSettings?: any;
  componentSettingName?: string;
}) {
  const schema = isInput
    ? editorConfig.questions.schema
    : editorConfig.content.schema;
  const target = useRef<HTMLDivElement>(null);
  const serializer = useRef(DOMSerializer.fromSchema(schema));

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

export class FormElementEditorPortal extends Component<{
  render: (
    updateBaseSetting: (
      setting: "body" | "isRequired" | "exportId" | "typeId"
    ) => (value: any) => void,
    updateComponentSetting: (
      setting: string,
      currentSettings: any
    ) => (value: any) => void,
    updateSurveySettings: (settings: {
      showFacilitationOption?: boolean;
      showProgress?: boolean;
    }) => void
  ) => ReactNode;
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

function FormElementEditorContainer({
  render,
  surveyId,
}: {
  surveyId: number;
  render: (
    updateBaseSetting: (
      setting: "body" | "isRequired" | "exportId" | "typeId"
    ) => (value: any) => void,
    updateComponentSetting: (
      setting: string,
      currentSettings: any
    ) => (value: any) => void,
    updateSurveySettings: (settings: {
      showFacilitationOption?: boolean;
      showProgress?: boolean;
    }) => void
  ) => ReactNode;
}) {
  const context = useContext(FormEditorPortalContext);
  const [
    updateBaseSetting,
    updateComponentSetting,
    mutationState,
  ] = useUpdateFormElement(context?.formElementSettings);
  const [
    updateSurvey,
    updateSurveyState,
  ] = useUpdateSurveyBaseSettingsMutation();
  return (
    <div className="space-y-4 text-sm p-3">
      {render(updateBaseSetting, updateComponentSetting, (settings) =>
        updateSurvey({
          variables: {
            id: surveyId,
            ...settings,
          },
        })
      )}
    </div>
  );
}

export function useUpdateFormElement(
  data?: Pick<
    FormElement,
    "body" | "componentSettings" | "id" | "isRequired" | "typeId"
  >
): [
  (
    setting: "body" | "isRequired" | "exportId" | "typeId"
  ) => (value: any) => void,
  (setting: string, currentSettings: any) => (value: any) => void,
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
        "body" | "componentSettings" | "isRequired" | "exportId" | "typeId"
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
    currentSettings: FormElementProps<any>
  ) => (value: any) =>
    updater({ componentSettings: { ...currentSettings, [setting]: value } });
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
  defaultComponentSettings?: T;
  /** For components like WelcomeMessage that shouldn't be a user option */
  templatesOnly?: boolean;
  advanceAutomatically?: boolean | ((componentSettings: T) => boolean);
  icon?: ReactNode;
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
  if (!Welcome) {
    throw new Error("WelcomeMessage FormElement not in Form");
  }
  if (!ThankYou) {
    throw new Error("ThankYou FormElement not in Form");
  }
  const bodyElements = elements.filter(
    (el) => el.typeId !== "WelcomeMessage" && el.typeId !== "ThankYou"
  );
  bodyElements.sort((a, b) => {
    return a.position - b.position;
  });
  return [Welcome, ...bodyElements, ThankYou] as T[];
}

export const SurveyContext = createContext<{
  isAdmin: boolean;
  projectName: string;
  projectUrl: string;
  surveyUrl: string;
  surveySupportsFacilitation: boolean;
  isFacilitatedResponse: boolean;
  bestName?: string;
  bestEmail?: string;
} | null>(null);
