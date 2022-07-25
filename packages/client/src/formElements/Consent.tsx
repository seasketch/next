import {
  CheckIcon,
  DocumentTextIcon,
  ExclamationIcon,
  XIcon,
} from "@heroicons/react/outline";
import { useCallback, useContext, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Trans, useTranslation } from "react-i18next";
import InputBlock from "../components/InputBlock";
import Spinner from "../components/Spinner";
import Switch from "../components/Switch";
import TextInput from "../components/TextInput";
import { useUploadConsentDocMutation } from "../generated/graphql";
import LocalizableTextInput from "../surveys/LocalizableTextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  useLocalizedComponentSetting,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import SurveyInputButton from "./SurveyInputButton";

type ConsentPresentation = "yesno" | "signature";

export type ConsentProps = {
  documentVersion?: number;
  documentLabel?: string;
  documentUrl?: string;
  requireDocClick?: boolean;
  presentation?: ConsentPresentation;
  agreeText?: string;
  disagreeText?: string;
  signaturePlaceholder?: string;
};

export type ConsentValue = {
  consented: boolean;
  /**
   * Whether the user clicked through the terms before consenting
   */
  clickedDoc: boolean;
  presentation: ConsentPresentation;
  docVersion: number;
  signature?: string;
};

function addCss(url: string) {
  var head = document.head,
    link = document.createElement("link");

  link.type = "text/css";
  link.rel = "stylesheet";
  link.href = url;

  head.appendChild(link);
}

const Consent: FormElementComponent<ConsentProps, ConsentValue> = (props) => {
  const { t } = useTranslation("surveys");
  const context = useContext(SurveyContext);
  const agreeText = useLocalizedComponentSetting("agreeText", props);
  const disagreeText = useLocalizedComponentSetting("disagreeText", props);
  const documentLabel = useLocalizedComponentSetting("documentLabel", props);
  const signaturePlaceholder = useLocalizedComponentSetting(
    "signaturePlaceholder",
    props
  );
  const sig = props.value?.signature || "";
  function setSig(value: string) {
    const newValue = {
      ...(props.value as ConsentValue),
      signature: value,
    };
    props.onChange(newValue, validate(props.componentSettings, newValue));
  }
  useEffect(() => {
    if (props.componentSettings.presentation === "signature") {
      addCss(
        "https://fonts.googleapis.com/css2?family=Cedarville+Cursive&display=swap"
      );
    }
  }, [props.componentSettings.presentation]);
  return (
    <>
      <div className="space-y-4">
        <FormElementBody
          formElementId={props.id}
          isInput={true}
          body={props.body}
          required={props.isRequired}
          editable={props.editable}
          alternateLanguageSettings={props.alternateLanguageSettings}
        />
        {props.editable ? (
          <UploadableConsentDocument
            label={documentLabel || t("Data Sharing Agreement")}
            version={props.componentSettings.documentVersion || 0}
            url={props.componentSettings.documentUrl}
            formElementId={props.id}
          />
        ) : props.componentSettings.documentUrl ? (
          <ConsentDocument
            url={cloudfrontToSameOrigin(props.componentSettings.documentUrl)}
            label={documentLabel}
            onClick={() => {
              const newValue = {
                ...(props.value as ConsentValue),
                clickedDoc: true,
                docVersion: props.componentSettings!.documentVersion!,
                presentation: props.componentSettings.presentation!,
                docUrl: props.componentSettings!.documentUrl,
              };
              props.onChange(
                newValue,
                validate(props.componentSettings, newValue)
              );
            }}
          />
        ) : (
          <div className="border-dashed border-2 rounded border-red-600 text-white bg-gray-800 p-2">
            <ExclamationIcon className="w-10 h-10 inline-block mr-2 text-gray-500" />
            <Trans ns="surveys">
              Component is misconfigured. Document url required.
            </Trans>
          </div>
        )}
        {props.componentSettings.presentation === "signature" && (
          <div className="max-w-lg">
            <div
              className="border-b my-4"
              style={{ width: "fit-content", minWidth: 320 }}
            >
              <span className="text-lg">
                {
                  // eslint-disable-next-line i18next/no-literal-string
                  "x"
                }
              </span>
              <span
                className="text-3xl mx-3"
                style={{ fontFamily: "Cedarville Cursive" }}
              >
                {sig}
              </span>
            </div>
            <div className="w-full sm:max-w-xs">
              <TextInput
                value={sig}
                label=""
                name=""
                autocomplete="name"
                onChange={setSig}
                placeholder={signaturePlaceholder || ""}
              />
            </div>
          </div>
        )}
        <div className="w-full max-w-full form-element-short-text pt-3 my-4 space-x-3 rtl:space-x-reverse">
          <SurveyInputButton
            disabled={!props.componentSettings.documentUrl}
            label={disagreeText || t("Do not agree")}
            Icon={XIcon}
            selected={props.value?.consented === false}
            onClick={() => {
              if (
                !props.value?.consented ||
                window.confirm(
                  t(
                    "Are you sure you no longer want to share data with this project? Your previous answers will be lost.",
                    { ns: "surveys" }
                  )
                )
              ) {
                const newValue = {
                  ...props.value,
                  clickedDoc: !!props.value?.clickedDoc,
                  docVersion: props.componentSettings!.documentVersion!,
                  consented: false,
                  presentation: props.componentSettings!.presentation!,
                };
                props.onChange(
                  newValue,
                  validate(props.componentSettings, newValue)
                );
                setTimeout(() => {
                  props.onRequestPrevious();
                }, 500);
              }
            }}
          />
          <SurveyInputButton
            disabled={!props.componentSettings.documentUrl}
            label={agreeText || t("Agree to terms")}
            Icon={CheckIcon}
            selected={props.value?.consented === true}
            onClick={() => {
              if (
                props.componentSettings.requireDocClick &&
                !props.value?.clickedDoc
              ) {
                window.alert(
                  t("Please open the attached terms before agreeing")
                );
              } else if (
                props.componentSettings.presentation === "signature" &&
                sig.length < 1
              ) {
                window.alert(
                  t("Please enter your full name in the signature field", {
                    ns: "surveys",
                  })
                );
              } else {
                const newValue = {
                  ...props.value,
                  clickedDoc: !!props.value?.clickedDoc,
                  docVersion: props.componentSettings!.documentVersion!,
                  consented: true,
                  presentation: props.componentSettings!.presentation!,
                };
                const errors = validate(props.componentSettings, newValue);
                props.onChange(newValue, errors, !errors);
              }
            }}
          />
        </div>
      </div>
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <InputBlock
                labelType="small"
                title={t("Input type", { ns: "admin:surveys" })}
                input={
                  <select
                    className="text-sm rounded w-28 pr-7"
                    value={props.componentSettings?.presentation || "yesno"}
                    onChange={(e) =>
                      updateComponentSetting(
                        "presentation",
                        props.componentSettings
                      )(e.target.value)
                    }
                  >
                    <option value="yesno">
                      {t("Agree/Disagree", { ns: "admin:surveys" })}
                    </option>
                    <option value="signature">
                      {t("Signature", { ns: "admin:surveys" })}
                    </option>
                  </select>
                }
              />
              {props.componentSettings.presentation === "signature" && (
                <LocalizableTextInput
                  label={t("Signature placeholder", { ns: "admin:surveys" })}
                  name="signaturePlaceholder"
                  value={signaturePlaceholder}
                  onChange={updateComponentSetting(
                    "signaturePlaceholder",
                    props.componentSettings,
                    context?.lang.code,
                    props.alternateLanguageSettings
                  )}
                />
              )}
              {props.componentSettings.presentation === "yesno" && (
                <>
                  <LocalizableTextInput
                    label={t("Agree button label", { ns: "admin:surveys" })}
                    name="agreeText"
                    value={agreeText}
                    onChange={updateComponentSetting(
                      "agreeText",
                      props.componentSettings,
                      context?.lang.code,
                      props.alternateLanguageSettings
                    )}
                  />
                  <LocalizableTextInput
                    label={t("Disagree button label", { ns: "admin:surveys" })}
                    name="disagreeText"
                    value={disagreeText}
                    onChange={updateComponentSetting(
                      "disagreeText",
                      props.componentSettings,
                      context?.lang.code,
                      props.alternateLanguageSettings
                    )}
                  />
                </>
              )}
              <LocalizableTextInput
                label={t("Document Label", { ns: "admin:surveys" })}
                name="documentLabel"
                value={documentLabel}
                placeholder={t("Data Sharing Agreement")}
                onChange={updateComponentSetting(
                  "documentLabel",
                  props.componentSettings,
                  context?.lang.code,
                  props.alternateLanguageSettings
                )}
              />
              <InputBlock
                labelType="small"
                title={t("Require document click", { ns: "admin:surveys" })}
                description={t(
                  "If required, users must click to open the attached document before agreeing"
                )}
                input={
                  <Switch
                    isToggled={props.componentSettings.requireDocClick}
                    onClick={updateComponentSetting(
                      "requireDocClick",
                      props.componentSettings
                    )}
                  />
                }
              />
            </>
          );
        }}
      />
    </>
  );
};

function validate(
  componentSettings: ConsentProps,
  value?: Partial<ConsentValue>
) {
  let errors = false;
  if (!value) {
    errors = true;
  }
  if (!value?.consented) {
    errors = true;
  }
  if (!value?.signature && componentSettings.presentation === "signature") {
    errors = true;
  }
  if (!value?.clickedDoc && componentSettings.requireDocClick === true) {
    errors = true;
  }
  return errors;
}

Consent.defaultComponentSettings = {
  documentLabel: "Data Sharing Agreement",
  presentation: "yesno",
  documentVersion: 0,
  requireDocClick: false,
  signaturePlaceholder: "Enter your full name",
};

Consent.defaultExportId = "consent";
Consent.defaultIsRequired = true;

Consent.label = <Trans>Consent</Trans>;
Consent.description = <Trans>Data sharing agreement</Trans>;
// eslint-disable-next-line i18next/no-literal-string
Consent.defaultBody = questionBodyFromMarkdown(`
# Informed Consent

Inform your users why you are collecting this data, who will use these data and how, and how their personal information will be protected. Upload a document with the full terms of the agreement, which they can keep for their reference.
`);

Consent.advanceAutomatically = true;
Consent.icon = () => (
  <div className="bg-yellow-500 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <svg
      viewBox="0 0 576 512"
      focusable="false"
      role="img"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className="transform scale-75 text-white"
      style={{ width: 80, height: 80 }}
    >
      <path
        fill="currentColor"
        d="M218.17 424.14c-2.95-5.92-8.09-6.52-10.17-6.52s-7.22.59-10.02 6.19l-7.67 15.34c-6.37 12.78-25.03 11.37-29.48-2.09L144 386.59l-10.61 31.88c-5.89 17.66-22.38 29.53-41 29.53H80c-8.84 0-16-7.16-16-16s7.16-16 16-16h12.39c4.83 0 9.11-3.08 10.64-7.66l18.19-54.64c3.3-9.81 12.44-16.41 22.78-16.41s19.48 6.59 22.77 16.41l13.88 41.64c19.75-16.19 54.06-9.7 66 14.16 1.89 3.78 5.49 5.95 9.36 6.26v-82.12l128-127.09V160H248c-13.2 0-24-10.8-24-24V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24v-40l-128-.11c-16.12-.31-30.58-9.28-37.83-23.75zM384 121.9c0-6.3-2.5-12.4-7-16.9L279.1 7c-4.5-4.5-10.6-7-17-7H256v128h128v-6.1zm-96 225.06V416h68.99l161.68-162.78-67.88-67.88L288 346.96zm280.54-179.63-31.87-31.87c-9.94-9.94-26.07-9.94-36.01 0l-27.25 27.25 67.88 67.88 27.25-27.25c9.95-9.94 9.95-26.07 0-36.01z"
      ></path>
    </svg>
  </div>
);

function ConsentDocument({
  url,
  label,
  version,
  onClick,
}: {
  url: string;
  label: string;
  version?: number;
  onClick?: () => void;
}) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className="flex items-center space-x-1"
      href={url}
      onClick={onClick}
    >
      <DocumentTextIcon className="w-6 h-6" />

      <div className="text-lg">
        <span className="underline">{label}</span>{" "}
        {version && <span>({"v" + version})</span>}
      </div>
    </a>
  );
}

function UploadableConsentDocument({
  version,
  url,
  formElementId,
  label,
}: {
  version: number;
  url?: string;
  formElementId: number;
  label: string;
}) {
  const [mutate, mutationState] = useUploadConsentDocMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const onDrop = useCallback(
    (acceptedFiles) => {
      // Do something with the files
      mutate({
        variables: {
          document: acceptedFiles[0],
          version: version + 1,
          formElementId,
        },
      }).catch((e) => {});
    },
    [version, formElementId]
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });
  const { t, i18n } = useTranslation(["admin:surveys"]);

  return (
    <>
      <div
        {...getRootProps()}
        className={`flex items-center ${
          isDragActive || !url
            ? "border-dashed border-2 rounded-lg border-gray-300 -ml-1.5 mt-1.5 -mb-0.5"
            : ""
        }`}
      >
        {url && (
          <div className="flex flex-col">
            <div className="flex">
              <ConsentDocument url={url} label={label} version={version} />
              {(mutationState.loading || false) && <Spinner className="ml-2" />}
            </div>
            {url && !mutationState.loading && (
              <div className="px-1 text-sm italic">
                <Trans ns="admin:surveys">
                  Drag and drop new documents here to{" "}
                  <button
                    onClick={(e) => inputRef.current?.click()}
                    className="underline italic"
                  >
                    upload a new version
                  </button>
                  . SeaSketch will record the exact version each user agrees to.
                </Trans>
              </div>
            )}
          </div>
        )}
        <span className="">
          {!url && !mutationState.loading && (
            <div className="p-5">
              <Trans ns="admin:surveys">
                Drag and drop your full data use agreement here.
              </Trans>
            </div>
          )}
          {!url && mutationState.loading && (
            <div className="p-5 flex">
              <Trans ns="admin:surveys">Uploading document...</Trans>
              {(mutationState.loading || false) && <Spinner className="ml-2" />}
            </div>
          )}

          <input
            ref={inputRef}
            // {...getInputProps()}
            id="logo-admin-input"
            type="file"
            title="choose"
            accept="image/pdf"
            disabled={mutationState.loading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const target = e.target;
                mutate({
                  variables: {
                    formElementId,
                    document: e.target.files[0],
                    version: version + 1,
                  },
                })
                  .catch((e) => {})
                  .then(() => {
                    target.value = "";
                  });
              }
            }}
            className="hidden py-2 px-1 text-sm leading-1 font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800 transition duration-150 ease-in-out"
          />

          {mutationState.error && (
            <p className="text-red-900">{mutationState.error.message}</p>
          )}
        </span>
      </div>
    </>
  );
}

export default Consent;

export function cloudfrontToSameOrigin(urlString: string) {
  if (
    navigator.serviceWorker?.controller &&
    process.env.REACT_APP_CLOUDFRONT_DOCS_DISTRO
  ) {
    const url = new URL(urlString);
    const newUrl = new URL(window.location.toString());
    newUrl.pathname = url.pathname;
    return newUrl.toString();
  } else {
    return urlString;
  }
}
