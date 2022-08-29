import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Client language settings are cross-project. They follow the user around no
 * matter which project they are in. That makes sense to some degree. If I speek
 * Portuguese I want to see projects or surveys in Portugues... if that language
 * is available. Surveys have a list of supported languages, and in the future
 * projects may as well. This hook will reset the client language selection if
 * they go to a survey or project that doesn't support their prefered language.
 *
 * @param supportedLanguages list of languages supported by the survey or project
 */
export default function useResetLanguage(supportedLanguages?: string[] | null) {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (supportedLanguages && i18n.language) {
      if (supportedLanguages.length === 0) {
        // only english supported
        if (i18n.language !== "en") {
          i18n.changeLanguage("en");
        }
      } else {
        const supported = Boolean(
          supportedLanguages.find(
            (lang) => lang.toLowerCase() === i18n.language.toLowerCase()
          )
        );
        if (!supported) {
          i18n.changeLanguage(supportedLanguages[0]);
        }
      }
    }
  }, [supportedLanguages, i18n.language]);
}
