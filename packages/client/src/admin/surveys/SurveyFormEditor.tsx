import { AdjustmentsIcon, ChevronLeftIcon } from "@heroicons/react/outline";
import { EyeIcon } from "@heroicons/react/solid";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Button from "../../components/Button";
import InputBlock from "../../components/InputBlock";
import SettingsIcon from "../../components/SettingsIcon";
import Switch from "../../components/Switch";
import {
  useSurveyFormEditorDetailsQuery,
  useUpdateSurveyBaseSettingsMutation,
  FormElement,
  FormElementType,
  Maybe,
} from "../../generated/graphql";
import { FormElementFactory, SurveyAppLayout } from "../../surveys/SurveyApp";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { FormEditorPortalContext } from "../../formElements/FormElement";
require("../../formElements/BodyEditor");

export default function SurveyFormEditor({
  surveyId,
  slug,
}: {
  surveyId: number;
  slug: string;
}) {
  const { t } = useTranslation();
  const formElementEditorContainerRef = useRef<HTMLDivElement>(null);
  const onError = useGlobalErrorHandler();
  const { data, loading, error } = useSurveyFormEditorDetailsQuery({
    variables: {
      slug,
      id: surveyId,
    },
  });
  const [focusState, setFocusState] = useState<{
    basicSettings: boolean;
    formElement: number | undefined;
  }>({
    basicSettings: true,
    formElement: undefined,
  });
  const [
    updateBaseSettingsMutation,
    updateBaseSettingsState,
  ] = useUpdateSurveyBaseSettingsMutation({
    onError,
  });
  function updateBaseSetting(settings: { showProgress?: boolean }) {
    updateBaseSettingsMutation({
      variables: { ...settings, id: data!.survey!.id },
      optimisticResponse: {
        updateSurvey: {
          survey: {
            __typename: "Survey",
            id: data!.survey!.id,
            showProgress:
              "showProgress" in settings
                ? settings.showProgress!
                : data!.survey!.showProgress,
          },
          __typename: "UpdateSurveyPayload",
        },
      },
    });
  }

  const selectedFormElement = (data?.survey?.form?.formElements || []).find(
    (e) => e.id === focusState.formElement
  );

  return (
    <div className="w-screen h-screen flex flex-col">
      <nav className="bg-white p-2 w-full border text-gray-800 flex items-center">
        <div className="flex-1">
          <Link
            to={`/${slug}/admin/surveys/`}
            className="inline-flex items-center space-x-3 text-sm font-medium"
          >
            <ChevronLeftIcon
              className="relative top-1 h-5 w-5 text-gray-500 mr-1"
              aria-hidden="true"
            />
          </Link>
          <Link to={`/${slug}/admin/surveys/`}>
            {data?.projectBySlug?.name}
          </Link>{" "}
          /{" "}
          <Link to={`/${slug}/admin/surveys/${surveyId}`}>
            {data?.survey?.name}
          </Link>
        </div>
        <Button
          href={`/${slug}/surveys/${surveyId}/0?preview=true`}
          label={
            <>
              <EyeIcon className="h-4 mr-2" />
              <span>{t("Preview Survey")}</span>
            </>
          }
          // primary
        />
      </nav>
      <div className="flex-1 flex">
        {/* Left Sidebar */}
        <div className="bg-white w-56 shadow">
          <div className="flex-1 overflow-y-auto flex flex-col min-h-full">
            <nav className="px-2 mt-2">
              <div className="space-y-1">
                <button
                  className={`${
                    focusState.basicSettings
                      ? "bg-cool-gray-100 text-black"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }
                      group flex items-center px-2 py-2 text-base leading-5 rounded-md w-full`}
                  aria-current={focusState.basicSettings ? "page" : undefined}
                  onClick={() =>
                    setFocusState({
                      basicSettings: true,
                      formElement: undefined,
                    })
                  }
                >
                  <AdjustmentsIcon
                    className={`${
                      focusState.basicSettings
                        ? "text-gray-500"
                        : "text-gray-400 group-hover:text-gray-500"
                    }
                        mr-3 flex-shrink-0 h-6 w-6`}
                    aria-hidden="true"
                  />
                  {t("Base Settings")}
                </button>
              </div>
            </nav>
            <nav className="mt-2 bg-cool-gray-100 flex-1">
              <h3 className="flex text-sm text-black bg-cool-gray-50 p-3 py-2 border-blue-gray-200 border items-center">
                <span className="flex-1">{t("Form Elements")}</span>
                <Button className="" small label={t("Add")} />
              </h3>
              <div
                className="mt-1 space-y-2 pb-4 pt-1"
                role="group"
                aria-labelledby="mobile-teams-headline"
              >
                {(data?.survey?.form?.formElements || []).map((element) => (
                  <FormElementListItem
                    key={element.id}
                    selected={
                      !!(
                        focusState.formElement &&
                        focusState.formElement === element.id
                      )
                    }
                    element={element}
                    type={element.type!}
                    onClick={() =>
                      setFocusState({
                        basicSettings: false,
                        formElement: element.id,
                      })
                    }
                  />
                ))}
              </div>
            </nav>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1">
          {/* <div className={`w-96 h-160 ml-auto mr-auto`}> */}
          <SurveyAppLayout
            skipScreenHeight={true}
            progress={
              selectedFormElement
                ? (data?.survey?.form?.formElements || []).indexOf(
                    selectedFormElement
                  ) / (data?.survey?.form?.formElements || []).length
                : 1 / 3
            }
            showProgress={data?.survey?.showProgress}
          >
            <FormEditorPortalContext.Provider
              value={{
                container: formElementEditorContainerRef.current,
                formElementSettings: selectedFormElement!,
              }}
            >
              {!focusState.basicSettings && (
                <FormElementFactory
                  {...selectedFormElement!}
                  onChange={() => null}
                  onSubmit={() => null}
                  typeName={selectedFormElement!.typeId}
                  editable={true}
                />
              )}
            </FormEditorPortalContext.Provider>
          </SurveyAppLayout>
          {/* </div> */}
        </div>
        {/* Right Sidebar */}
        <div className="bg-white w-64 shadow">
          <>
            <h3 className="flex text-sm text-black bg-cool-gray-50 p-3 py-2 border-b border-blue-gray-200  items-center">
              {focusState.basicSettings
                ? t("Base Settings")
                : selectedFormElement?.type?.componentName}
            </h3>
            <div className="p-3" ref={formElementEditorContainerRef}>
              {focusState.basicSettings && (
                <InputBlock
                  title={t("Show Progress")}
                  input={
                    <Switch
                      isToggled={data?.survey?.showProgress}
                      onClick={(val) =>
                        updateBaseSetting({ showProgress: val })
                      }
                    />
                  }
                />
              )}
            </div>
          </>
        </div>
      </div>
    </div>
  );
}

function FormElementListItem({
  element,
  type,
  onClick,
  selected,
}: {
  element: Pick<FormElement, "body" | "componentSettings" | "exportId">;
  type: Pick<FormElementType, "label">;
  onClick?: () => void;
  selected: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer mx-2 px-4 py-2 shadow-md bg-white w-50 border border-black border-opacity-20 rounded ${
        selected && "ring-2 ring-blue-300"
      }`}
    >
      <div className="">{type.label}</div>
      <div className="text-xs italic overflow-x-hidden truncate">
        {collectText(element.body)}
      </div>
    </div>
  );
}

/**
 * Extracts text from the given ProseMirror document up to the character limit
 * @param body ProseMirror document json
 * @param charLimit Character limit
 * @returns string
 */
function collectText(body: any, charLimit = 32) {
  let text = "";
  if (body.text) {
    text += body.text + " ";
  }
  if (body.content && body.content.length) {
    for (const node of body.content) {
      if (text.length > charLimit) {
        return text;
      }
      text += collectText(node);
    }
  }
  return text;
}
