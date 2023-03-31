import { TranslateIcon } from "@heroicons/react/outline";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  useProjectMetadataQuery,
  useSetTranslatedPropsMutation,
} from "../generated/graphql";
import getSlug from "../getSlug";
import Modal from "./Modal";
import languages, { LangDetails } from "../lang/supported";
import { useGlobalErrorHandler } from "./GlobalErrorHandler";

interface PropTranslations {
  [langCode: string]: string;
}

export default function TranslatedPropControl({
  id,
  propName,
  typeName,
  label,
  defaultValue,
  className,
}: {
  id: number;
  propName: string;
  typeName: string;
  label: string;
  defaultValue?: string | null;
  className?: string;
}) {
  const { data } = useProjectMetadataQuery({
    variables: { slug: getSlug() },
    fetchPolicy: "cache-first",
  });
  const { t } = useTranslation("admin:lang");
  const [modalOpen, setModalOpen] = useState(false);
  const supportedLanguages = useMemo(
    () =>
      (data?.project?.supportedLanguages || [])
        .map((l) => languages.find((lang) => lang.code === l))
        .filter((l) => l) as LangDetails[],
    [data?.project?.supportedLanguages]
  );
  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useSetTranslatedPropsMutation({
    onError,
  });

  const [state, setState] = useState<PropTranslations>({});
  useEffect(() => {
    const translatedProps = data?.project?.translatedProps;
    if (!translatedProps) {
      setState({});
    } else {
      const propTranslations: PropTranslations = {};
      Object.keys(translatedProps).forEach((langCode) => {
        propTranslations[langCode] = translatedProps[langCode][propName];
      });
      setState(propTranslations);
    }
  }, [data?.project?.translatedProps, propName]);

  return (
    <>
      {(data?.project?.supportedLanguages || []).length > 1 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setModalOpen(true);
          }}
          className={`group  cursor-pointer  ${className}`}
        >
          <TranslateIcon className="text-gray-400 group-hover:text-gray-700 transition-colors w-5 h-5" />
        </button>
      )}
      {modalOpen && (
        <Modal
          title={label}
          className="w-96"
          onRequestClose={() => setModalOpen(false)}
          disableBackdropClick={true}
          scrollable={true}
          footer={[
            {
              label: t("Save"),
              variant: "primary",
              onClick: async () => {
                const translations: { languageCode: string; value?: string }[] =
                  [];
                Object.keys(state).forEach((langCode) => {
                  translations.push({
                    languageCode: langCode,
                    value: state[langCode],
                  });
                });
                await mutate({
                  variables: {
                    id,
                    propName,
                    typeName: "select * from auth;",
                    translations,
                  },
                });
              },
            },
            {
              label: t("Cancel"),
              onClick: () => setModalOpen(false),
            },
          ]}
        >
          <p className="text-gray-500 text-sm mb-4">
            <Trans ns="admin:lang">
              Provide translations for your supported languages below. If a
              translation is not specified, the default value will be used.
            </Trans>
          </p>
          <div className="space-y-4">
            {supportedLanguages.map((lang) => (
              <div key={lang.code} className="flex items-center space-x-2">
                <div className="flex-1">{lang.name}</div>
                <input
                  data-lpignore="true"
                  // Disable 1password autofill
                  // https://1password.community/discussion/comment/606453/#Comment_606453
                  id={"search" + typeName + propName}
                  name={"search" + typeName + propName}
                  autoComplete="off"
                  type="text"
                  className={`flex-2 block border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black `}
                  placeholder={defaultValue || undefined}
                  defaultValue={state[lang.code] || ""}
                  onChange={(e) => {
                    setState({
                      ...state,
                      [lang.code]: e.target.value,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
