import useCurrentProjectMetadata from "./useCurrentProjectMetadata";
import languages from "./lang/supported";
import { useTranslation } from "react-i18next";
import { getSelectedLanguage } from "./surveys/LanguageSelector";

export default function useCurrentLang() {
  const { data } = useCurrentProjectMetadata();
  const { i18n } = useTranslation();
  const filteredLanguages = languages.filter(
    (f) =>
      !data?.project?.supportedLanguages ||
      data?.project.supportedLanguages.find((o) => o === f.code) ||
      f.code === "EN" ||
      i18n.language?.toLowerCase() === f.code.toLowerCase()
  );

  const { selectedLang } = getSelectedLanguage(i18n, filteredLanguages);

  return selectedLang;
}
