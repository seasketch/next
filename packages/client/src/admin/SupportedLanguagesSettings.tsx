import { useTranslation, Trans } from "react-i18next";
import Switch from "../components/Switch";
import {
  useProjectMetadataQuery,
  useToggleLanguageSupportMutation,
} from "../generated/graphql";
import languages from "../lang/supported";

export default function SupportedLanguagesSettings({ slug }: { slug: string }) {
  const { t } = useTranslation("admin");
  const { data } = useProjectMetadataQuery({
    variables: {
      slug,
    },
  });
  const [mutate, mutationState] = useToggleLanguageSupportMutation({});

  return (
    <>
      <div className="mt-5 relative">
        <div className="shadow sm:rounded-md sm:overflow-hidden">
          <div className="px-4 py-5 bg-white sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {t("Supported Languages")}
            </h3>
            {mutationState.error && <p>{mutationState.error.message}</p>}
            <p className="mt-1 text-sm leading-5 text-gray-500">
              <Trans ns="admin">
                SeaSketch will detect a user's language from browser and system
                settings and show content in that language if supported. Users
                can also select from supported languages in the sidebar.
              </Trans>
            </p>
            <div className="relative py-2 mt-4">
              {languages.map((lang, i) => (
                <div
                  key={lang.code}
                  className={`flex items-center space-x-2 p-3 rounded ${
                    i % 2 ? "" : "bg-gray-50"
                  }`}
                >
                  <div className="flex-1">{lang.name}</div>
                  <Switch
                    className=""
                    isToggled={
                      (data?.project?.supportedLanguages || []).indexOf(
                        lang.code
                      ) !== -1 || lang.code === "EN"
                    }
                    disabled={lang.code === "EN"}
                    onClick={(toggled) => {
                      mutate({
                        variables: {
                          slug,
                          code: lang.code,
                          enable: toggled,
                        },
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
