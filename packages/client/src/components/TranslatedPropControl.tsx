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
import { getSelectedLanguage } from "../surveys/LanguageSelector";
import { gql, useApolloClient } from "@apollo/client";

// Avoid graphql codegen by obfuscating the gql tag
function ggg(l: string) {
  return gql(l);
}

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
  const supportedLanguages = useMemo(() => {
    const options = data?.project?.supportedLanguages || [];
    const filteredLanguages = languages.filter(
      (f) => options.find((o) => o === f.code) || f.code.toLowerCase() === "en"
    );
    return filteredLanguages;
  }, [data?.project?.supportedLanguages]);

  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useSetTranslatedPropsMutation({
    onError,
    update: (cache, result) => {
      const data = result.data;
      // @ts-ignore
      window.cache = cache;
      if (data) {
        cache.writeFragment({
          id: cache.identify({
            __typename: data.setTranslatedProp.typeName,
            id: data.setTranslatedProp.id,
          }),
          fragment: ggg(`
            fragment TranslatedProps on ${data.setTranslatedProp.typeName} {
              translatedProps
            }
          `),
          data: {
            translatedProps: data.setTranslatedProp.translatedProps,
          },
        });
      }
    },
    onCompleted: (data) => {
      setModalOpen(false);
    },
  });

  const client = useApolloClient();
  const [state, setState] = useState<PropTranslations>({});
  useEffect(() => {
    const record: any = client.cache.readFragment({
      // eslint-disable-next-line i18next/no-literal-string
      fragment: ggg(`
        fragment TranslatedProps on ${typeName} {
          translatedProps
        }
      `),
      id: client.cache.identify({ __typename: typeName, id }),
    });
    if (!record) {
      throw new Error("No record");
    }
    const translatedProps = record.translatedProps as {
      [langCode: string]: { [propName: string]: string };
    };
    if (!translatedProps) {
      setState({});
    } else {
      const propTranslations: PropTranslations = {};
      Object.keys(translatedProps).forEach((langCode) => {
        propTranslations[langCode] = translatedProps[langCode][propName];
      });
      setState(propTranslations);
    }
  }, [data?.project?.translatedProps, propName, typeName, id, client]);

  return (
    <>
      {supportedLanguages.length > 1 && (
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
              loading: mutationState.loading,
              disabled: mutationState.loading,
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
                    typeName,
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

type TranslatableRecordType = { translatedProps: any } & { [key: string]: any };
export function useTranslatedProps(
  baseRecord?: TranslatableRecordType | null | undefined
) {
  const { i18n } = useTranslation();
  const { data } = useProjectMetadataQuery({ variables: { slug: getSlug() } });
  const filteredLanguages = languages.filter(
    (f) =>
      !data?.project?.supportedLanguages ||
      data.project.supportedLanguages.find((o) => o === f.code) ||
      f.code === "EN"
  );
  const lang = getSelectedLanguage(i18n, filteredLanguages);
  return function getTranslatedProp(
    propName: string,
    record?: TranslatableRecordType
  ) {
    const obj = record || baseRecord;
    if (!obj) {
      return "";
    }
    const defaultValue = obj[propName] as string;
    if (
      obj.translatedProps[lang.selectedLang.code] &&
      propName in obj.translatedProps[lang.selectedLang.code] &&
      obj.translatedProps[lang.selectedLang.code][propName]?.length > 0
    ) {
      return obj.translatedProps[lang.selectedLang.code][propName] as string;
    }
    return defaultValue;
  };
}
